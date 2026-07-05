import { SyncController } from "./sync.controller";
import { OfflineSyncService } from "../services/offline-sync.service";

describe("SyncController (integration-style)", () => {
  it("pushes a CREATE_SALE event and gets it applied", async () => {
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
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    } as any;

    const service = new OfflineSyncService(prisma);
    const controller = new SyncController(service);

    const body = {
      events: [
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
      ],
    };

    const res = await controller.push(body as any);
    expect(res.data).toBeDefined();
    expect(res.data.applied).toEqual(["evt-1"]);
  });
});
