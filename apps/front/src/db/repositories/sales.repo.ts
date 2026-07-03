import { v4 as uuidv4 } from "uuid";

import db from "../index";
import type { Sale, SyncEvent } from "../index";

export async function createLocalSale(sale: Omit<Sale, "id" | "createdAt">) {
  const offlineId = sale.offlineId ?? uuidv4();
  const id = `local-${offlineId}`;
  const createdAt = new Date().toISOString();
  const record: Sale = { id, offlineId, ...sale, createdAt } as Sale;

  await (db as any).transaction(
    "rw",
    (db as any).sales,
    (db as any).syncEvents,
    async () => {
      await (db as any).sales.put(record);
      const ev: SyncEvent = {
        createdAt,
        offlineId,
        payload: record,
        status: "PENDING",
        type: "CREATE_SALE",
      };
      await (db as any).syncEvents.add(ev);
    }
  );

  return record;
}

export async function getPendingSyncCount() {
  return db.syncEvents.where("status").equals("PENDING").count();
}

export async function getPendingEvents(limit = 50) {
  return db.syncEvents.where("status").equals("PENDING").limit(limit).toArray();
}

export async function markEventApplied(id: number) {
  return db.syncEvents.update(id, { status: "APPLIED" });
}
