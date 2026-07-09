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
  return request<Sale>("/api/sales", {
    data: payload,
    method: "POST",
  });
}
