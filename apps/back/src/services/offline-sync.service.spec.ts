import { OfflineSyncService } from "./offline-sync.service";

describe("OfflineSyncService", () => {
  it("creates a sale, sale items and stock movement when processing a CREATE_SALE event", async () => {
    const tx = {
      sale: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "sale-1" }),
      },
      saleItem: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      stockMovement: {
        create: jest.fn().mockResolvedValue({ id: "movement-1" }),
      },
      productBranch: {
        findUnique: jest.fn().mockResolvedValue({
          productId: "prod-1",
          branchId: "branch-1",
          stock: 10,
        }),
        update: jest.fn().mockResolvedValue({
          productId: "prod-1",
          branchId: "branch-1",
          stock: 8,
        }),
      },
    };

    const prisma = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    } as any;

    const service = new OfflineSyncService(prisma);

    const result = await service.processEvents([
      {
        id: "evt-1",
        type: "CREATE_SALE",
        payload: {
          offlineId: "offline-1",
          tenantId: "tenant-1",
          branchId: "branch-1",
          userId: "user-1",
          total: 100,
          subtotal: 90,
          taxAmount: 10,
          discountAmount: 0,
          createdAt: "2024-01-01T00:00:00.000Z",
          items: [
            {
              productId: "prod-1",
              quantity: 2,
              unitPrice: 50,
              taxRate: 0.16,
              subtotal: 100,
            },
          ],
        },
      },
    ]);

    expect(result.applied).toEqual(["evt-1"]);
    expect(tx.sale.create).toHaveBeenCalled();
    expect(tx.saleItem.createMany).toHaveBeenCalled();
    expect(tx.stockMovement.create).toHaveBeenCalled();
    expect(tx.productBranch.update).toHaveBeenCalled();
  });
});
