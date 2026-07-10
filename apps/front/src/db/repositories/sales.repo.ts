import { v4 as uuidv4 } from "uuid";

import db from "../index";
import type { Sale, SyncEvent } from "../index";

export async function createLocalSale(input: {
  items: { productId: string; quantity: number }[];
}) {
  const offlineId = uuidv4();
  const id = `local-${offlineId}`;
  const createdAt = new Date().toISOString();

  // Build local Sale record for Dexie display
  const localItems = input.items.map((it) => ({
    id: `i-${uuidv4()}`,
    price: 0,
    productId: it.productId,
    quantity: it.quantity,
  }));
  const record: Sale = {
    createdAt,
    id,
    items: localItems,
    offlineId,
    total: 0,
  };

  // Build sync payload matching backend contract
  // FIXME(HEL-XXX): resolve real prices from Dexie products catalog
  const syncItems = input.items.map((it) => ({
    productId: it.productId,
    quantity: it.quantity,
    subtotal: 0,
    taxRate: 0,
    unitPrice: 0,
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
        subtotal: 0,
        taxAmount: 0,
        total: 0,
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
