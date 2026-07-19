import { v4 as uuidv4 } from "uuid";

import db from "../index";
import type { Sale, SyncEvent } from "../index";
import { getLocalProduct } from "./products.repo";

export async function createLocalSale(input: {
  items: { productId: string; quantity: number }[];
}) {
  const offlineId = uuidv4();
  const id = `local-${offlineId}`;
  const createdAt = new Date().toISOString();

  const resolvedItems = await Promise.all(
    input.items.map(async (it) => {
      const product = await getLocalProduct(it.productId);

      if (!product) {
        throw new Error(
          `Producto no encontrado en catálogo local: ${it.productId}`
        );
      }

      const unitPrice = product.price;
      const subtotal = unitPrice * it.quantity;

      return {
      productId: it.productId,
      quantity: it.quantity,
      subtotal,
      taxRate: product.taxRate,
     unitPrice,
};
    })
  );

  const saleSubtotal = resolvedItems.reduce(
    (sum, it) => sum + it.subtotal,
    0
  );
  const saleTaxAmount = resolvedItems.reduce(
    (sum, it) => sum + it.subtotal * it.taxRate,
    0
  );
  const saleTotal = saleSubtotal + saleTaxAmount;

  // Build local Sale record for Dexie display
  const localItems = resolvedItems.map((it) => ({
    id: `i-${uuidv4()}`,
    price: it.unitPrice,
    productId: it.productId,
    quantity: it.quantity,
  }));
  const record: Sale = {
    createdAt,
    id,
    items: localItems,
    offlineId,
    total: saleTotal,
  };

  // Build sync payload matching backend contract
  const syncItems = resolvedItems.map((it) => ({
    productId: it.productId,
    quantity: it.quantity,
    subtotal: it.subtotal,
    taxRate: it.taxRate,
    unitPrice: it.unitPrice,
  }));

  await db.transaction("rw", db.sales, db.syncEvents, async () => {
    await db.sales.put(record);
    const ev: SyncEvent = {
      createdAt,
      offlineId,
      payload: {
        createdAt,
        discountAmount: 0,
        items: syncItems,
        offlineId,
        subtotal: saleSubtotal,
        taxAmount: saleTaxAmount,
        total: saleTotal,
      },
      status: "PENDING",
      type: "CREATE_SALE",
    };
    await db.syncEvents.add(ev);
  });

  return record;
}

export function getPendingSyncCount() {
  return db.syncEvents.where("status").equals("PENDING").count();
}

export function getPendingEvents(limit = 50) {
  return db.syncEvents.where("status").equals("PENDING").limit(limit).toArray();
}

export function markEventApplied(id: number | string) {
  return db.syncEvents.update(Number(id), { status: "APPLIED" });
}

export function markEventRejected(id: number | string) {
  return db.syncEvents.update(Number(id), { status: "REJECTED" });
}

export function markEventConflict(id: number | string) {
  return db.syncEvents.update(Number(id), { status: "CONFLICT" });
}
