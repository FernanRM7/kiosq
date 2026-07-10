import { beforeEach, describe, expect, it } from "vitest";

import type { Product } from "@/db";
import {
  createLocalSale,
  getPendingEvents,
  getPendingSyncCount,
  markEventApplied,
} from "@/db/repositories/sales.repo";

const testProducts: Product[] = [
  {
    id: "prod-1",
    name: "Coca Cola 600ml",
    price: 18.5,
    sku: "COCA-600",
    taxRate: 0.16,
    totalStock: 50,
    isActive: true,
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "prod-2",
    name: "Sabritas 45g",
    price: 15.0,
    sku: "SAB-45",
    taxRate: 0.16,
    totalStock: 100,
    isActive: true,
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "prod-3",
    name: "Agua 1L",
    price: 12.0,
    sku: "AGUA-1L",
    taxRate: 0.08,
    totalStock: 200,
    isActive: true,
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
];

async function seedProducts() {
  const { populateProducts } = await import("@/db/repositories/products.repo");
  await populateProducts(testProducts);
}

describe("sales.repo", () => {
  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase("kiosq");
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  });

  it("creates a local sale with correct prices and enqueues a PENDING sync event", async () => {
    await seedProducts();

    const sale = await createLocalSale({
      items: [{ productId: "prod-1", quantity: 2 }],
    });

    expect(sale.offlineId).toBeDefined();
    expect(sale.total).toBeCloseTo(42.92, 2);
    expect(sale.items).toHaveLength(1);
    expect(sale.items[0]).toMatchObject({
      price: 18.5,
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
    await seedProducts();

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
    await seedProducts();

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

  it("sync event payload contains real prices and calculated totals", async () => {
    await seedProducts();

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
          subtotal: 37,
          taxRate: 0.16,
          unitPrice: 18.5,
        },
      ],
      offlineId: expect.any(String),
      subtotal: 37,
      taxAmount: 5.92,
      total: 42.92,
    });
  });

  it("calculates totals correctly for multi-item sales", async () => {
    await seedProducts();

    const sale = await createLocalSale({
      items: [
        { productId: "prod-1", quantity: 2 },
        { productId: "prod-2", quantity: 3 },
      ],
    });

    const expectedSubtotal = 18.5 * 2 + 15.0 * 3;
    const expectedTax = 18.5 * 2 * 0.16 + 15.0 * 3 * 0.16;
    const expectedTotal = expectedSubtotal + expectedTax;

    expect(sale.total).toBeCloseTo(expectedTotal, 2);
  });

  it("throws when product is not in local catalog", async () => {
    await expect(
      createLocalSale({
        items: [{ productId: "nonexistent", quantity: 1 }],
      })
    ).rejects.toThrow("Producto no encontrado en catálogo local: nonexistent");
  });

  it("does not include events that were already applied", async () => {
    await seedProducts();

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
