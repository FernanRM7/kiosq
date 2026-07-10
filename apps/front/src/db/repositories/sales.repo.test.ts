import { beforeEach, describe, expect, it } from "vitest";

import {
  createLocalSale,
  getPendingEvents,
  getPendingSyncCount,
  markEventApplied,
} from "./sales.repo";

describe("sales.repo", () => {
  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase("kiosq");
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  });

  it("creates a local sale and enqueues a PENDING sync event", async () => {
    const sale = await createLocalSale({
      items: [{ productId: "prod-1", quantity: 2 }],
    });

    expect(sale.offlineId).toBeDefined();
    expect(sale.total).toBe(0);
    expect(sale.items).toHaveLength(1);
    expect(sale.items[0]).toMatchObject({
      productId: "prod-1",
      quantity: 2,
    });

    const pendingCount = await getPendingSyncCount();
    expect(pendingCount).toBe(1);

    const events = await getPendingEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      status: "PENDING",
      type: "CREATE_SALE",
    });
  });

  it("marks events as APPLIED", async () => {
    await createLocalSale({
      items: [{ productId: "prod-1", quantity: 1 }],
    });

    const events = await getPendingEvents();
    expect(events).toHaveLength(1);
    const eventId = events[0].id!;

    await markEventApplied(eventId);

    const pendingAfter = await getPendingSyncCount();
    expect(pendingAfter).toBe(0);
  });

  it("returns multiple pending events in order", async () => {
    await createLocalSale({
      items: [{ productId: "prod-1", quantity: 1 }],
    });
    await createLocalSale({
      items: [{ productId: "prod-2", quantity: 3 }],
    });
    await createLocalSale({
      items: [{ productId: "prod-3", quantity: 5 }],
    });

    const count = await getPendingSyncCount();
    expect(count).toBe(3);

    const events = await getPendingEvents(10);
    expect(events).toHaveLength(3);
  });

  it("sync event payload matches backend contract shape", async () => {
    await createLocalSale({
      items: [{ productId: "prod-1", quantity: 2 }],
    });

    const events = await getPendingEvents();
    const payload = events[0].payload as Record<string, unknown>;

    expect(payload).toMatchObject({
      createdAt: expect.any(String),
      discountAmount: 0,
      items: [
        {
          productId: "prod-1",
          quantity: 2,
          subtotal: 0,
          taxRate: 0,
          unitPrice: 0,
        },
      ],
      offlineId: expect.any(String),
      subtotal: 0,
      taxAmount: 0,
      total: 0,
    });
  });

  it("does not include events that were already applied", async () => {
    await createLocalSale({
      items: [{ productId: "prod-1", quantity: 1 }],
    });
    await createLocalSale({
      items: [{ productId: "prod-2", quantity: 2 }],
    });

    const events = await getPendingEvents();
    await markEventApplied(events[0].id!);

    const remaining = await getPendingEvents();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(events[1].id);
  });
});
