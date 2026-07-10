import { OfflineSyncService } from "../services/offline-sync.service";
import { SyncController } from "./sync.controller";

describe("SyncController (integration-style)", () => {
  it("pushes a CREATE_SALE event and gets it applied", async () => {
    const tx = {
      productBranch: {
        findUnique: jest.fn().mockResolvedValue({
          branchId: "branch-1",
          productId: "prod-1",
          stock: 10,
        }),
        update: jest.fn().mockResolvedValue({
          branchId: "branch-1",
          productId: "prod-1",
          stock: 8,
        }),
      },
      sale: {
        create: jest.fn().mockResolvedValue({ id: "sale-1" }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      saleItem: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      stockMovement: {
        create: jest.fn().mockResolvedValue({ id: "movement-1" }),
      },
    };

    const prisma = {
      /* eslint-disable-next-line promise/prefer-await-to-callbacks, node/callback-return, arrow-body-style */
      $transaction: jest.fn(async (cb: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, promise/prefer-await-to-callbacks
        return await (cb as any)(tx);
      }),
    } as unknown as { $transaction: jest.Mock };

    const service = new OfflineSyncService(prisma);
    const controller = new SyncController(service);

    const body = {
      events: [
        {
          id: "evt-1",
          payload: {
            branchId: "branch-1",
            createdAt: "2024-01-01T00:00:00.000Z",
            discountAmount: 0,
            items: [
              {
                productId: "prod-1",
                quantity: 2,
                subtotal: 100,
                taxRate: 0.16,
                unitPrice: 50,
              },
            ],
            offlineId: "offline-1",
            subtotal: 90,
            taxAmount: 10,
            tenantId: "tenant-1",
            total: 100,
            userId: "user-1",
          },
          type: "CREATE_SALE",
        },
      ],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await controller.push(body as any);
    expect(res.data).toBeDefined();
    expect(res.data.applied).toEqual({ applied: ["evt-1"] }.applied);
  });
});
