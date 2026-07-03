import Dexie from "dexie";

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
  payload: any;
  status: "PENDING" | "APPLIED" | "FAILED";
  createdAt?: string;
}

class KiosqDB extends (Dexie as any) {
  products: any;
  sales: any;
  syncEvents: any;

  constructor() {
    super("kiosq");
    (this as any).version(1).stores({
      products: "id, name, updatedAt",
      sales: "id, offlineId, createdAt, syncedAt",
      syncEvents: "++id, offlineId, type, status, createdAt",
    });
  }
}

export const db = new KiosqDB();

export default db;
