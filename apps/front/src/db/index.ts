import Dexie from "dexie";

/* eslint-disable @typescript-eslint/method-signature-style */

// Minimal local Table interface to avoid depending on Dexie internal exports
// and keep strong typing for commonly used operations in the repo.
interface WhereEqualsResult<T> {
  count: () => Promise<number>;
  limit: (n: number) => { toArray: () => Promise<T[]> };
}

interface WhereReturn<T> {
  equals: (value: unknown) => WhereEqualsResult<T>;
}

interface TableType<T, K = unknown> {
  put: (obj: T) => Promise<unknown>;
  add: (obj: T) => Promise<unknown>;
  update: (key: K, changes: Partial<T>) => Promise<number>;
  where: (index: string) => WhereReturn<T>;
  count?: () => Promise<number>;
  toArray?: () => Promise<T[]>;
  // add other methods as needed
}

export interface Product {
  id: string;
  name: string;
  price: number;
  updatedAt?: string;
}
export interface SaleItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
}
export interface Sale {
  id: string;
  offlineId?: string;
  total: number;
  items: SaleItem[];
  createdAt: string;
  syncedAt?: string;
}
export interface SyncEvent {
  id?: number;
  offlineId?: string;
  type: string;
  payload: unknown;
  status: "PENDING" | "APPLIED" | "FAILED";
  createdAt?: string;
}

class KiosqDB extends (Dexie as unknown as { new (name?: string): unknown }) {
  // Use the local TableType for typing table properties.
  products!: TableType<Product, string>;
  sales!: TableType<Sale, string>;
  syncEvents!: TableType<SyncEvent, number>;

  constructor() {
    // @ts-expect-error - runtime Dexie constructor is used; typing is coerced above
    super("kiosq");
    // The runtime Dexie instance exposes `version(...).stores(...)`.
    // Narrowly type the `version` helper to avoid using `any`.
    interface DexieWithVersion {
      version(n: number): { stores(schema: Record<string, string>): void };
    }
    (this as unknown as DexieWithVersion).version(1).stores({
      products: "id, name, updatedAt",
      sales: "id, offlineId, createdAt, syncedAt",
      syncEvents: "++id, offlineId, type, status, createdAt",
    });
  }
}

export const db = new KiosqDB();

export default db;
