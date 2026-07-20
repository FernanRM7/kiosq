import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../lib/prisma.service";
import {
  InsufficientStockError,
  MissingOfflineIdError,
  ProductNotFoundError,
  SyncError,
} from "../lib/sync-errors";
import type {
  SyncEventInput,
  SyncFailedItem,
  SyncItemInput,
} from "../schemas/sync.schema";
import type { AuthenticatedSessionResult } from "../types/session.type";

interface SyncContext {
  tenantId: string;
  userId: string;
  branchId: string | null;
}

interface TransactionClient {
  productBranch: {
    findUnique: (args: {
      where: { productId_branchId: { branchId: string; productId: string } };
    }) => Promise<{ stock: number } | null>;
    update: (args: {
      data: { stock: number };
      where: { productId_branchId: { branchId: string; productId: string } };
    }) => Promise<unknown>;
  };
  sale: {
    create: (args: {
      data: Record<string, unknown>;
    }) => Promise<{ id: string }>;
    findUnique: (args: {
      where: { offlineId: string };
    }) => Promise<{ id: string } | null>;
  };
  saleItem: {
    createMany: (args: { data: Record<string, unknown>[] }) => Promise<unknown>;
  };
  stockMovement: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
}

@Injectable()
export class OfflineSyncService {
  private readonly logger = new Logger(OfflineSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async resolveContext(
    session: AuthenticatedSessionResult
  ): Promise<SyncContext> {
    const user = await this.prisma.user.findUnique({
      select: { branchId: true, id: true, isActive: true, tenantId: true },
      where: { workosUserId: session.userId },
    });

    if (!user) {
      throw new ForbiddenException("Usuario no encontrado en el workspace");
    }

    if (!user.isActive) {
      throw new ForbiddenException(
        "Tu cuenta está inactiva. Contacta al administrador."
      );
    }

    return {
      branchId: user.branchId,
      tenantId: user.tenantId,
      userId: user.id,
    };
  }

  private async applyInventoryDecrement(
    transaction: TransactionClient,
    items: SyncItemInput[],
    branchId: string,
    tenantId: string,
    userId: string
  ): Promise<void> {
    // Agrupa items por productId para evitar lost-update race cuando el
    // payload contiene el mismo producto en varias líneas. Se procesa cada
    // producto único secuencialmente: una lectura, un update, un movement.
    const quantityByProduct = new Map<string, number>();

    for (const item of items) {
      const { productId, quantity } = item;

      if (!productId || quantity <= 0) {
        throw new BadRequestException(
          `Item inválido: productId=${productId} quantity=${quantity}`
        );
      }

      quantityByProduct.set(
        productId,
        (quantityByProduct.get(productId) ?? 0) + quantity
      );
    }

    for (const [productId, totalQuantity] of quantityByProduct) {
      const productBranch = await transaction.productBranch.findUnique({
        where: {
          productId_branchId: {
            branchId,
            productId,
          },
        },
      });

      if (!productBranch) {
        throw new ProductNotFoundError(productId, branchId);
      }

      if (productBranch.stock < totalQuantity) {
        throw new InsufficientStockError(productId);
      }

      await transaction.productBranch.update({
        data: {
          stock: productBranch.stock - totalQuantity,
        },
        where: {
          productId_branchId: {
            branchId,
            productId,
          },
        },
      });

      await transaction.stockMovement.create({
        data: {
          branchId,
          productId,
          quantity: -totalQuantity,
          reason: "Offline sale sync",
          tenantId,
          type: "SALE",
          userId,
        },
      });
    }
  }

  private async applyCreateSaleEvent(
    event: SyncEventInput,
    ctx: SyncContext
  ): Promise<void> {
    const { payload } = event;
    const { offlineId } = payload;

    if (!offlineId) {
      throw new MissingOfflineIdError();
    }

    const { branchId } = ctx;

    if (!branchId) {
      throw new BadRequestException(
        "No tienes una sucursal asignada. Asigna una sucursal antes de sincronizar."
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const transaction = tx as unknown as TransactionClient;
      const { sale } = transaction;
      const existing = await sale.findUnique({ where: { offlineId } });

      if (existing) {
        return;
      }

      const items = Array.isArray(payload.items) ? payload.items : [];

      await this.applyInventoryDecrement(
        transaction,
        items,
        branchId,
        ctx.tenantId,
        ctx.userId
      );

      const createdSale = await sale.create({
        data: {
          branchId,
          createdAt: payload.createdAt
            ? new Date(payload.createdAt)
            : new Date(),
          discountAmount: payload.discountAmount ?? 0,
          offlineId,
          status: "COMPLETED",
          subtotal: payload.subtotal ?? 0,
          syncedAt: new Date(),
          taxAmount: payload.taxAmount ?? 0,
          tenantId: ctx.tenantId,
          total: payload.total ?? 0,
          userId: ctx.userId,
        },
      });

      if (items.length > 0) {
        await transaction.saleItem.createMany({
          data: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            saleId: createdSale.id,
            subtotal: item.subtotal,
            taxRate: item.taxRate,
            unitPrice: item.unitPrice,
          })),
        });
      }
    });
  }

  private deriveSyncStatus(
    failureCode: string
  ): "APPLIED" | "CONFLICT" | "REJECTED" | null {
    // Errores transitorios — el cliente reintenta, no se persisten
    if (failureCode === "INTERNAL_ERROR") {
      return null;
    }
    // Conflictos de stock — server-wins, necesita reconciliación humana
    if (failureCode === "INSUFFICIENT_STOCK") {
      return "CONFLICT";
    }
    // Errores permanentes — evento inválido
    return "REJECTED";
  }

  private async persistSyncEvent(
    event: SyncEventInput,
    ctx: SyncContext,
    failure: SyncFailedItem | null
  ): Promise<void> {
    const status = failure ? this.deriveSyncStatus(failure.code) : "APPLIED";

    // Errores transitorios no se persisten (el cliente reintentará)
    if (status === null) {
      return;
    }

    /*
     * NOTA: SyncEvent se persiste fuera de la transacción de venta.
     * Existe una ventana pequeña donde la venta se crea exitosamente
     * pero el SyncEvent no se persiste (ej. crash post-commit).
     * Esto es aceptable para POS: la venta existe en DB, el cliente
     * recibió {applied: [id]} y marcará el evento como APPLIED en
     * Dexie. En el peor caso, la auditoría pierde un registro, no
     * los datos de la venta.
     */
    await this.prisma.syncEvent.create({
      data: {
        clientTs: new Date(event.payload.createdAt),
        conflictNote: failure?.message ?? null,
        deviceId: null,
        entityId: event.payload.offlineId ?? "unknown",
        entityType: "Sale",
        operation: "CREATE",
        payload: event.payload as Prisma.InputJsonValue,
        status: status as "APPLIED" | "CONFLICT" | "REJECTED",
        tenantId: ctx.tenantId,
      },
    });
  }

  private mapError(eventId: number, error: unknown): SyncFailedItem {
    if (error instanceof SyncError) {
      return {
        code: error.code,
        id: eventId,
        message: error.message,
      };
    }
    if (error instanceof BadRequestException) {
      return { code: "BAD_REQUEST", id: eventId, message: error.message };
    }
    if (error instanceof ForbiddenException) {
      return { code: "FORBIDDEN", id: eventId, message: error.message };
    }

    return {
      code: "INTERNAL_ERROR",
      id: eventId,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  async processEvents(
    events: SyncEventInput[],
    session: AuthenticatedSessionResult
  ) {
    const ctx = await this.resolveContext(session);

    const applied: number[] = [];
    const failed: SyncFailedItem[] = [];

    for (const event of events) {
      try {
        if (event.type === "CREATE_SALE") {
          await this.applyCreateSaleEvent(event, ctx);
          await this.persistSyncEvent(event, ctx, null);
          applied.push(event.id);
          continue;
        }

        const failedItem = {
          code: "UNKNOWN_EVENT_TYPE",
          id: event.id,
          message: `Tipo de evento desconocido: ${event.type}`,
        } satisfies SyncFailedItem;
        await this.persistSyncEvent(event, ctx, failedItem);
        failed.push(failedItem);
      } catch (error) {
        const failedItem = this.mapError(event.id, error);
        await this.persistSyncEvent(event, ctx, failedItem);
        failed.push(failedItem);
      }
    }

    return { applied, failed };
  }

  async getChangesSince(
    params: { since?: string; cursor?: string; limit?: number },
    session: AuthenticatedSessionResult
  ) {
    const ctx = await this.resolveContext(session);
    const { since, cursor, limit = 50 } = params;
    const take = Math.min(limit, 200) + 1;

    const where: Record<string, unknown> = {
      tenantId: ctx.tenantId,
    };

    if (since) {
      where.syncedAt = { gte: new Date(since) };
    }

    if (cursor) {
      where.id = { gt: cursor };
    }

    const sales = await this.prisma.sale.findMany({
      orderBy: { id: "asc" },
      take,
      where,
    });

    const hasMore = sales.length === take;

    return {
      hasMore,
      nextCursor: hasMore ? sales.at(-1)?.id : null,
      sales: hasMore ? sales.slice(0, take - 1) : sales,
    };
  }
}
