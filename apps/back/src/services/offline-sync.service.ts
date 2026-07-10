import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common";

import { PrismaService } from "../lib/prisma.service";
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

    if (!user?.isActive) {
      throw new ForbiddenException("Debes tener un workspace activo");
    }

    return {
      branchId: user.branchId,
      tenantId: user.tenantId,
      userId: user.id,
    };
  }

  private async validateInventory(
    transaction: TransactionClient,
    items: SyncItemInput[],
    branchId: string,
    tenantId: string,
    userId: string
  ): Promise<void> {
    await Promise.all(
      items.map(async (item) => {
        const { productId, quantity } = item;

        if (!productId || !branchId || quantity <= 0) {
          return;
        }

        const productBranch = await transaction.productBranch.findUnique({
          where: {
            productId_branchId: {
              branchId,
              productId,
            },
          },
        });

        if (!productBranch) {
          throw new Error(
            `ProductBranch not found for ${productId}/${branchId}`
          );
        }

        if (productBranch.stock < quantity) {
          throw new Error(`Insufficient stock for product ${productId}`);
        }

        await transaction.productBranch.update({
          data: {
            stock: productBranch.stock - quantity,
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
            quantity: -quantity,
            reason: "Offline sale sync",
            tenantId,
            type: "SALE",
            userId,
          },
        });
      })
    );
  }

  private async applyCreateSaleEvent(
    event: SyncEventInput,
    ctx: SyncContext
  ): Promise<void> {
    const { payload } = event;
    const { offlineId } = payload;

    if (!offlineId) {
      throw new Error("Missing offlineId in CREATE_SALE payload");
    }

    const branchId = ctx.branchId;

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

      await this.validateInventory(
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

  private mapError(eventId: number, error: unknown): SyncFailedItem {
    if (error instanceof BadRequestException) {
      return { id: eventId, code: "BAD_REQUEST", message: error.message };
    }
    if (error instanceof ForbiddenException) {
      return { id: eventId, code: "FORBIDDEN", message: error.message };
    }

    const message = error instanceof Error ? error.message : String(error);
    let code = "INTERNAL_ERROR";

    if (
      message.includes("MISSING_OFFLINE_ID") ||
      message.includes("Missing offlineId")
    ) {
      code = "MISSING_OFFLINE_ID";
    } else if (message.includes("ProductBranch not found")) {
      code = "PRODUCT_NOT_FOUND";
    } else if (message.includes("Insufficient stock")) {
      code = "INSUFFICIENT_STOCK";
    }

    return { id: eventId, code, message };
  }

  async processEvents(
    events: SyncEventInput[],
    session: AuthenticatedSessionResult
  ) {
    const ctx = await this.resolveContext(session);

    const applied: number[] = [];
    const failed: SyncFailedItem[] = [];

    await Promise.all(
      events.map(async (event) => {
        try {
          if (event.type === "CREATE_SALE") {
            await this.applyCreateSaleEvent(event, ctx);
            applied.push(event.id);
            return;
          }

          failed.push({
            id: event.id,
            code: "UNKNOWN_EVENT_TYPE",
            message: `Tipo de evento desconocido: ${event.type}`,
          });
        } catch (error) {
          failed.push(this.mapError(event.id, error));
        }
      })
    );

    return { applied, failed };
  }

  async getChangesSince(
    since: string | undefined,
    session: AuthenticatedSessionResult
  ) {
    const ctx = await this.resolveContext(session);
    const where = {
      tenantId: ctx.tenantId,
      ...(since ? { syncedAt: { gte: new Date(since) } } : {}),
    };
    const sales = await this.prisma.sale.findMany({
      orderBy: { createdAt: "asc" },
      take: 200,
      where,
    });
    return { sales };
  }
}
