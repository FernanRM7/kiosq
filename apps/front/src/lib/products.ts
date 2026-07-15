import type { Product as DexieProduct } from "@/db";
import {
  getLocalProducts,
  populateProducts,
} from "@/db/repositories/products.repo";
import { ApiClientError, request } from "@/lib/api";

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
    barcode: api.barcode,
    category: api.category,
    categoryId: api.categoryId,
    cost: api.cost,
    createdAt: api.createdAt,
    description: api.description,
    id: api.id,
    imageUrl: api.imageUrl,
    isActive: api.isActive,
    name: api.name,
    price: api.price,
    sku: api.sku,
    taxRate: api.taxRate,
    totalStock: api.totalStock,
    updatedAt: api.updatedAt,
  };
}

function toApiProduct(local: DexieProduct): Product {
  return {
    barcode: local.barcode ?? null,
    category: local.category ?? null,
    categoryId: local.categoryId ?? null,
    cost: local.cost ?? null,
    createdAt: local.createdAt ?? "",
    description: local.description ?? null,
    id: local.id,
    imageUrl: local.imageUrl ?? null,
    isActive: local.isActive,
    name: local.name,
    price: local.price,
    sku: local.sku,
    taxRate: local.taxRate,
    totalStock: local.totalStock,
    updatedAt: local.updatedAt ?? "",
  };
}

export async function listProducts(): Promise<Product[]> {
  return {
    barcode: local.barcode ?? null,
    category: local.category ?? null,
    categoryId: local.categoryId ?? null,
    cost: local.cost ?? null,
    createdAt: local.createdAt ?? "",
    description: local.description ?? null,
    id: local.id,
    imageUrl: local.imageUrl ?? null,
    isActive: local.isActive,
    name: local.name,
    price: local.price,
    sku: local.sku,
    taxRate: local.taxRate,
    totalStock: local.totalStock,
    updatedAt: local.updatedAt ?? "",
  };
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
