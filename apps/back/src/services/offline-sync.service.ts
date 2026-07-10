import { Injectable } from "@nestjs/common";

import { PrismaService } from "../lib/prisma.service";

interface OfflineSaleItem {
  productId: string;
  quantity?: number | string;
  subtotal?: number | string;
  taxRate?: number | string;
  unitPrice?: number | string;
}

interface OfflineSalePayload {
  branchId?: string;
  createdAt?: string;
  discountAmount?: number | string;
  items?: OfflineSaleItem[];
  offlineId?: string;
  subtotal?: number | string;
  taxAmount?: number | string;
  tenantId?: string;
  total?: number | string;
  userId?: string;
}

interface OfflineEvent {
  id: string | number;
  payload?: OfflineSalePayload;
  type: string;
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
  constructor(private readonly prisma: PrismaService) {}

  private async validateInventory(
    transaction: TransactionClient,
    items: OfflineSaleItem[],
    branchId: string,
    tenantId: string,
    userId: string
  ): Promise<void> {
    await Promise.all(
      items.map(async (item) => {
        const { productId } = item;
        const quantity = Number(item.quantity ?? 0);

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

  private async applyCreateSaleEvent(event: OfflineEvent): Promise<void> {
    const payload = event.payload ?? {};
    const { offlineId } = payload;

    if (!offlineId) {
      throw new Error("Missing offlineId in CREATE_SALE payload");
    }

    await this.prisma.$transaction(async (tx) => {
      const transaction = tx as unknown as TransactionClient;
      const { sale } = transaction;
      const existing = await sale.findUnique({ where: { offlineId } });

      if (existing) {
        return;
      }

      const items = Array.isArray(payload.items) ? payload.items : [];
      const branchId = payload.branchId ?? "";
      const tenantId = payload.tenantId ?? "";
      const userId = payload.userId ?? "";

      await this.validateInventory(
        transaction,
        items,
        branchId,
        tenantId,
        userId
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
          tenantId,
          total: payload.total ?? 0,
          userId,
        },
      });

      if (items.length > 0) {
        await transaction.saleItem.createMany({
          data: items.map((item) => ({
            productId: item.productId,
            quantity: Number(item.quantity ?? 0),
            saleId: createdSale.id,
            subtotal: Number(item.subtotal ?? 0),
            taxRate: Number(item.taxRate ?? 0),
            unitPrice: Number(item.unitPrice ?? 0),
          })),
        });
      }
    });
  }

  async processEvents(events: unknown[]) {
    const applied = await Promise.all(
      events.map(async (eventUnknown) => {
        try {
          const event = eventUnknown as OfflineEvent;
          if (event.type === "CREATE_SALE") {
            await this.applyCreateSaleEvent(event);
          }

          return event.id;
        } catch {
          // ignored — event failed to apply
        }
      })
    );

    return {
      applied: applied.filter(
        (value): value is string | number => value !== undefined
      ),
    };
  }

  async getChangesSince(since?: string) {
    const where = since ? { syncedAt: { gte: new Date(since) } } : {};
    const sales = await this.prisma.sale.findMany({
      orderBy: { createdAt: "asc" },
      take: 200,
      where,
    });
    return { sales };
  }
}
