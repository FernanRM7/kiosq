import { v4 as uuidv4 } from "uuid";

import { createLocalSale } from "@/db/repositories/sales.repo";
import { request } from "@/lib/api";

export interface SaleItemResponse {
  id: string;
  productId: string;
  product: { id: string; name: string; sku: string };
  quantity: number;
  unitPrice: number;
  taxRate: number;
  subtotal: number;
}

export interface SalePaymentResponse {
  id: string;
  method: string;
  amount: number;
  reference: string | null;
  status: string;
}

export interface Sale {
  id: string;
  branchId: string;
  userId: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  createdAt: string;
  items: SaleItemResponse[];
  payments: SalePaymentResponse[];
}

export interface CreateSalePayload {
  items: { productId: string; quantity: number }[];
  paymentMethod: string;
  branchId?: string;
}

export function listSales(): Promise<Sale[]> {
  return request<Sale[]>("/api/sales");
}

export function createSale(payload: CreateSalePayload): Promise<Sale> {
  if (!navigator.onLine) {
    // create a minimal local sale record and enqueue a sync event
    const items = payload.items.map((it) => ({
      id: `i-${uuidv4()}`,
      price: 0,
      productId: it.productId,
      quantity: it.quantity,
    }));
    const total = items.reduce((s, it) => s + (it.price ?? 0) * it.quantity, 0);
    return createLocalSale({
      items,
      total,
    }) as unknown as Promise<Sale>;
  }

  return request<Sale>("/api/sales", {
    data: payload,
    method: "POST",
  });
}
