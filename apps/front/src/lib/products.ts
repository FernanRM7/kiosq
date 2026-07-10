import { ApiClientError, request } from "@/lib/api";
import type { Product as DexieProduct } from "@/db";
import {
  getLocalProducts,
  populateProducts,
} from "@/db/repositories/products.repo";

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

function toDexieProduct(api: Product): DexieProduct {
  return {
    id: api.id,
    name: api.name,
    sku: api.sku,
    price: api.price,
    taxRate: api.taxRate,
    totalStock: api.totalStock,
    isActive: api.isActive,
    updatedAt: api.updatedAt,
  };
}

export async function listProducts(): Promise<Product[]> {
  try {
    const products = await request<Product[]>("/api/products");

    if (navigator.onLine && products.length > 0) {
      await populateProducts(products.map(toDexieProduct));
    }

    return products;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 0) {
      const local = await getLocalProducts();

      return local as unknown as Product[];
    }

    throw error;
  }
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
