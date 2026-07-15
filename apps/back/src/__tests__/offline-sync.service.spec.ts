import { ForbiddenException } from "@nestjs/common";

import { OfflineSyncService } from "../services/offline-sync.service";
import {
  makeCreateSaleEvent,
  makeMockPrisma,
  makeMockSession,
  makeMockTransaction,
} from "./helpers/sync-test-helpers";

describe("OfflineSyncService", () => {
  const session = makeMockSession();

  it("creates a sale, sale items and stock movement when processing a CREATE_SALE event", async () => {
    const tx = makeMockTransaction();
    const prisma = makeMockPrisma(tx);
    const service = new OfflineSyncService(prisma);

    const result = await service.processEvents(
      [makeCreateSaleEvent()],
      session
    );

    expect(result.applied).toEqual([1]);
    expect(result.failed).toEqual([]);
    expect(tx.sale.create).toHaveBeenCalled();
    expect(tx.saleItem.createMany).toHaveBeenCalled();
    expect(tx.stockMovement.create).toHaveBeenCalled();
    expect(tx.productBranch.update).toHaveBeenCalled();
  });

  it("returns a failed result with INSUFFICIENT_STOCK code when stock is insufficient", async () => {
    const tx = makeMockTransaction({ productBranchStock: 1 });
    const prisma = makeMockPrisma(tx);
    const service = new OfflineSyncService(prisma);

    const result = await service.processEvents(
      [makeCreateSaleEvent({ id: 99 })],
      session
    );

    expect(result.applied).toEqual([]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatchObject({
      id: 99,
      code: "INSUFFICIENT_STOCK",
    });
    expect(tx.sale.create).not.toHaveBeenCalled();
    expect(tx.saleItem.createMany).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    expect(tx.productBranch.update).not.toHaveBeenCalled();
  });

  it("is idempotent — duplicate offlineId does not create a second sale", async () => {
    const tx = makeMockTransaction({ existingSale: { id: "existing-sale" } });
    const prisma = makeMockPrisma(tx);
    const service = new OfflineSyncService(prisma);

    const result = await service.processEvents(
      [makeCreateSaleEvent()],
      session
    );

    expect(result.applied).toEqual([1]);
    expect(result.failed).toEqual([]);
    expect(tx.sale.create).not.toHaveBeenCalled();
  });

  it("returns a failed result with MISSING_OFFLINE_ID on event without offlineId", async () => {
    const tx = makeMockTransaction();
    const prisma = makeMockPrisma(tx);
    const service = new OfflineSyncService(prisma);

    const result = await service.processEvents(
      [makeCreateSaleEvent({ id: 5, omitOfflineId: true })],
      session
    );

    expect(result.applied).toEqual([]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatchObject({
      id: 5,
      code: "MISSING_OFFLINE_ID",
    });
    expect(tx.sale.create).not.toHaveBeenCalled();
  });

  it("returns a failed result with PRODUCT_NOT_FOUND when ProductBranch does not exist", async () => {
    const tx = makeMockTransaction({ productBranchFound: false });
    const prisma = makeMockPrisma(tx);
    const service = new OfflineSyncService(prisma);

    const result = await service.processEvents(
      [makeCreateSaleEvent({ id: 7 })],
      session
    );

    expect(result.applied).toEqual([]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatchObject({
      id: 7,
      code: "PRODUCT_NOT_FOUND",
    });
    expect(tx.sale.create).not.toHaveBeenCalled();
  });

  it("returns a failed result with UNKNOWN_EVENT_TYPE on unsupported type", async () => {
    const tx = makeMockTransaction();
    const prisma = makeMockPrisma(tx);
    const service = new OfflineSyncService(prisma);

    const result = await service.processEvents(
      [makeCreateSaleEvent({ id: 10, type: "UPDATE_PRODUCT" })],
      session
    );

    expect(result.applied).toEqual([]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatchObject({
      id: 10,
      code: "UNKNOWN_EVENT_TYPE",
    });
    expect(tx.sale.create).not.toHaveBeenCalled();
  });

  it("processes multiple events mixing applied and failed", async () => {
    const tx = makeMockTransaction();
    const prisma = makeMockPrisma(tx);
    const service = new OfflineSyncService(prisma);

    const result = await service.processEvents(
      [
        makeCreateSaleEvent({ id: 1, offlineId: "offline-a" }),
        makeCreateSaleEvent({ id: 2, offlineId: "offline-b", type: "UNKNOWN" }),
        makeCreateSaleEvent({ id: 3, offlineId: "offline-c" }),
      ],
      session
    );

    expect(result.applied).toEqual([1, 3]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatchObject({
      id: 2,
      code: "UNKNOWN_EVENT_TYPE",
    });
  });

  it("returns empty arrays for empty events", async () => {
    const tx = makeMockTransaction();
    const prisma = makeMockPrisma(tx);
    const service = new OfflineSyncService(prisma);

    const result = await service.processEvents([], session);

    expect(result.applied).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  it("throws ForbiddenException when user is not active", async () => {
    const tx = makeMockTransaction();
    const prisma = makeMockPrisma(tx, { isActive: false });
    const service = new OfflineSyncService(prisma);

    await expect(
      service.processEvents([makeCreateSaleEvent()], session)
    ).rejects.toThrow(ForbiddenException);
  });

  it("throws ForbiddenException when user does not exist", async () => {
    const tx = makeMockTransaction();
    const prisma = makeMockPrisma(tx, { userNotFound: true });
    const service = new OfflineSyncService(prisma);

    await expect(
      service.processEvents([makeCreateSaleEvent()], session)
    ).rejects.toThrow(ForbiddenException);
  });

  it("deduplicates duplicate productId lines and decrements stock once", async () => {
    const tx = makeMockTransaction({ productBranchStock: 10 });
    const prisma = makeMockPrisma(tx);
    const service = new OfflineSyncService(prisma);

    const event = makeCreateSaleEvent({
      id: 1,
      offlineId: "offline-dup",
      quantity: 3,
    });
    // Add a second item with same productId but different quantity
    event.payload.items = [
      {
        productId: "prod-1",
        quantity: 3,
        subtotal: 150,
        taxRate: 0.16,
        unitPrice: 50,
      },
      {
        productId: "prod-1",
        quantity: 2,
        subtotal: 100,
        taxRate: 0.16,
        unitPrice: 50,
      },
    ];

    const result = await service.processEvents([event], session);

    expect(result.applied).toEqual([1]);
    expect(result.failed).toEqual([]);
    // Debe haber llamado a update UNA sola vez con stock total reducido
    expect(tx.productBranch.update).toHaveBeenCalledTimes(1);
    expect(tx.productBranch.update).toHaveBeenCalledWith({
      data: { stock: 5 },
      where: {
        productId_branchId: { branchId: "branch-1", productId: "prod-1" },
      },
    });
    expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
  });

  it("returns BAD_REQUEST when item has empty productId", async () => {
    const tx = makeMockTransaction();
    const prisma = makeMockPrisma(tx);
    const service = new OfflineSyncService(prisma);

    const event = makeCreateSaleEvent({ id: 5, offlineId: "offline-bad" });
    event.payload.items = [
      {
        productId: "",
        quantity: 2,
        subtotal: 100,
        taxRate: 0.16,
        unitPrice: 50,
      },
    ];

    const result = await service.processEvents([event], session);

    expect(result.applied).toEqual([]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatchObject({
      id: 5,
      code: "BAD_REQUEST",
    });
  });

  describe("SyncEvent persistence", () => {
    it("persists SyncEvent with status APPLIED when sale is created", async () => {
      const tx = makeMockTransaction();
      const prisma = makeMockPrisma(tx);
      const service = new OfflineSyncService(prisma);

      await service.processEvents([makeCreateSaleEvent()], session);

      expect(prisma.syncEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "APPLIED" }),
        })
      );
    });

    it("persists SyncEvent with status CONFLICT when stock is insufficient", async () => {
      const tx = makeMockTransaction({ productBranchStock: 1 });
      const prisma = makeMockPrisma(tx);
      const service = new OfflineSyncService(prisma);

      await service.processEvents([makeCreateSaleEvent({ id: 99 })], session);

      expect(prisma.syncEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "CONFLICT",
            conflictNote: expect.stringContaining("Insufficient stock"),
          }),
        })
      );
    });

    it("persists SyncEvent with status REJECTED when offlineId is missing", async () => {
      const tx = makeMockTransaction();
      const prisma = makeMockPrisma(tx);
      const service = new OfflineSyncService(prisma);

      await service.processEvents(
        [makeCreateSaleEvent({ id: 5, omitOfflineId: true })],
        session
      );

      expect(prisma.syncEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "REJECTED",
            entityId: "unknown",
          }),
        })
      );
    });

    it("persists SyncEvent with status REJECTED for unknown event type", async () => {
      const tx = makeMockTransaction();
      const prisma = makeMockPrisma(tx);
      const service = new OfflineSyncService(prisma);

      await service.processEvents(
        [makeCreateSaleEvent({ id: 10, type: "UPDATE_PRODUCT" })],
        session
      );

      expect(prisma.syncEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "REJECTED" }),
        })
      );
    });

    it("does NOT persist SyncEvent for transient INTERNAL_ERROR", async () => {
      // Un error INTERNAL_ERROR no tiene código específico — simula un error
      // genérico no mapeado (ej. un error de red que lanza algo que no es
      // ni BadRequest ni Forbidden)
      const tx = makeMockTransaction();
      // Force an unexpected error by making $transaction fail in a way that
      // mapError can only assign INTERNAL_ERROR
      const prisma = {
        ...makeMockPrisma(tx),
        $transaction: jest.fn(() =>
          Promise.reject(new Error("Unexpected DB error"))
        ),
      } as unknown as ReturnType<typeof makeMockPrisma>;
      const service = new OfflineSyncService(prisma);

      await service.processEvents([makeCreateSaleEvent({ id: 42 })], session);

      expect(prisma.syncEvent.create).not.toHaveBeenCalled();
    });

    it("persists SyncEvent for duplicated offlineId (idempotent)", async () => {
      const tx = makeMockTransaction({ existingSale: { id: "existing-sale" } });
      const prisma = makeMockPrisma(tx);
      const service = new OfflineSyncService(prisma);

      await service.processEvents([makeCreateSaleEvent()], session);

      // Tras idempotencia, el SyncEvent aún se persiste con APPLIED
      expect(prisma.syncEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "APPLIED" }),
        })
      );
    });
  });

  describe("getChangesSince", () => {
    it("filters sales by tenantId from session", async () => {
      const tx = makeMockTransaction();
      const prisma = makeMockPrisma(tx);
      const service = new OfflineSyncService(prisma);

      await service.getChangesSince(undefined, session);

      expect(prisma.sale.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "asc" },
        take: 200,
        where: { tenantId: "tenant-1" },
      });
    });

    it("filters by syncedAt when since is provided", async () => {
      const tx = makeMockTransaction();
      const prisma = makeMockPrisma(tx);
      const service = new OfflineSyncService(prisma);

      await service.getChangesSince("2024-06-01T00:00:00.000Z", session);

      expect(prisma.sale.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "asc" },
        take: 200,
        where: {
          tenantId: "tenant-1",
          syncedAt: { gte: new Date("2024-06-01T00:00:00.000Z") },
        },
      });
    });
  });
});
