import { ForbiddenException } from "@nestjs/common";

import {
  makeCreateSaleEvent,
  makeMockPrisma,
  makeMockSession,
  makeMockTransaction,
} from "../test/helpers/sync-test-helpers";
import { OfflineSyncService } from "./offline-sync.service";

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
    const prisma = makeMockPrisma(tx);
    const service = new OfflineSyncService(prisma);

    const result = await service.processEvents([], session);

    expect(result.applied).toEqual([]);
  });

  it("throws ForbiddenException when user is not active", async () => {
    const tx = makeMockTransaction();
    const prisma = makeMockPrisma(tx, { isActive: false });
    const service = new OfflineSyncService(prisma);

    await expect(
      service.processEvents([makeCreateSaleEvent()], session)
    ).rejects.toThrow(ForbiddenException);
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
