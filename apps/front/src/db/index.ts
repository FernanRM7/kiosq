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
  bulkPut: (items: T[]) => Promise<unknown>;
  update: (key: K, changes: Partial<T>) => Promise<number>;
  clear: () => Promise<void>;
  get: (key: K) => Promise<T | undefined>;
  where: (index: string) => WhereReturn<T>;
  count: () => Promise<number>;
  toArray: () => Promise<T[]>;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  taxRate: number;
  totalStock: number;
  isActive: boolean;
  barcode?: string | null;
  description?: string | null;
  cost?: number | null;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
  imageUrl?: string | null;
  createdAt?: string;
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
  status: "PENDING" | "APPLIED" | "FAILED" | "REJECTED" | "CONFLICT";
  createdAt?: string;
}

// Create a runtime Dexie instance and cast to a shape the app expects.
const rawDb = new (Dexie as unknown as { new (name?: string): unknown })(
  "kiosq"
) as unknown;
interface DexieWithVersion {
  version(n: number): { stores(schema: Record<string, string>): void };
}
(rawDb as unknown as DexieWithVersion).version(2).stores({
  products: "id, name, sku, updatedAt",
  sales: "id, offlineId, createdAt, syncedAt",
  syncEvents: "++id, offlineId, type, status, createdAt",
});

interface KiosqDBShape {
  transaction: (...args: unknown[]) => Promise<unknown> | unknown;
  products: TableType<Product, string>;
  sales: TableType<Sale, string>;
  syncEvents: TableType<SyncEvent, number>;
}

export const db = rawDb as unknown as KiosqDBShape;

export default db;
