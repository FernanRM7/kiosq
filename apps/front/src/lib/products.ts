import { request } from "@/lib/api";

export const PRODUCTS_CHANGED_EVENT = "products:changed";

export interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  price: number;
  cost: number | null;
  taxRate: number;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  imageUrl: string | null;
  isActive: boolean;
  totalStock: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductPayload {
  sku: string;
  name: string;
  price: number;
  barcode?: string | null;
  description?: string | null;
  cost?: number | null;
  stock?: number;
  taxRate?: number;
  categoryId?: string | null;
  imageUrl?: string | null;
}

export function listProducts(): Promise<Product[]> {
  return request<Product[]>("/api/products");
}

export function createProduct(payload: ProductPayload): Promise<Product> {
  return request<Product>("/api/products", {
    data: payload,
    method: "POST",
  });
}

export function updateProduct(
  productId: string,
  payload: Partial<ProductPayload>
): Promise<Product> {
  return request<Product>(`/api/products/${productId}`, {
    data: payload,
    method: "PATCH",
  });
}

export function deleteProduct(productId: string): Promise<Product> {
  return request<Product>(`/api/products/${productId}`, {
    method: "DELETE",
  });
}
