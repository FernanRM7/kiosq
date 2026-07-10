import { v4 as uuidv4 } from "uuid";

import db from "../index";
import type { Sale, SyncEvent } from "../index";

export async function createLocalSale(sale: Omit<Sale, "id" | "createdAt">) {
  const offlineId = sale.offlineId ?? uuidv4();
  const id = `local-${offlineId}`;
  const createdAt = new Date().toISOString();
  const record: Sale = { id, offlineId, ...sale, createdAt } as Sale;

  await db.transaction("rw", db.sales, db.syncEvents, async () => {
    await db.sales.put(record);
    const ev: SyncEvent = {
      createdAt,
      offlineId,
      payload: record,
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
