import { Injectable } from "@nestjs/common";

import { PrismaService } from "../lib/prisma.service";

@Injectable()
export class OfflineSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async processEvents(events: any[]) {
    const applied: (string | number)[] = [];

    for (const ev of events) {
      try {
        if (ev.type === "CREATE_SALE") {
          const payload = ev.payload ?? {};
          const { offlineId } = payload;

          if (!offlineId) {
            throw new Error("Missing offlineId in CREATE_SALE payload");
          }

          await this.prisma.$transaction(async (tx: any) => {
            const existing = await tx.sale.findUnique({ where: { offlineId } });
            if (existing) {
              return;
            }

            const sale = await tx.sale.create({
              data: {
                branchId: payload.branchId ?? "",
                createdAt: payload.createdAt
                  ? new Date(payload.createdAt)
                  : new Date(),
                discountAmount: payload.discountAmount ?? 0,
                offlineId,
                status: "COMPLETED",
                subtotal: payload.subtotal ?? 0,
                syncedAt: new Date(),
                taxAmount: payload.taxAmount ?? 0,
                tenantId: payload.tenantId ?? "",
                total: payload.total ?? 0,
                userId: payload.userId ?? "",
              },
            });

            const items = Array.isArray(payload.items) ? payload.items : [];
            if (items.length > 0) {
              await tx.saleItem.createMany({
                data: items.map((item: any) => ({
                  productId: item.productId,
                  quantity: Number(item.quantity ?? 0),
                  saleId: sale.id,
                  subtotal: Number(item.subtotal ?? 0),
                  taxRate: Number(item.taxRate ?? 0),
                  unitPrice: Number(item.unitPrice ?? 0),
                })),
              });
            }

            for (const item of items) {
              const { productId } = item;
              const branchId = payload.branchId ?? "";
              const quantity = Number(item.quantity ?? 0);

              if (!productId || !branchId || quantity <= 0) {
                continue;
              }

              const productBranch = await tx.productBranch.findUnique({
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

              await tx.productBranch.update({
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

              await tx.stockMovement.create({
                data: {
                  branchId,
                  productId,
                  quantity: -quantity,
                  reason: "Offline sale sync",
                  tenantId: payload.tenantId ?? "",
                  type: "SALE",
                  userId: payload.userId ?? "",
                },
              });
            }
          });
        }

        applied.push(ev.id);
      } catch {
        // Ignore and continue to the next event.
      }
    }

    return { applied };
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
