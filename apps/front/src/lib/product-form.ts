import { z } from "zod";

import type { Product, ProductPayload } from "@/lib/products";

const maxTwoDecimals = (value: number) =>
  Number.isInteger(Math.round(value * 100) - value * 100);

const maxFourDecimals = (value: number) =>
  Number.isInteger(Math.round(value * 10_000) - value * 10_000);

const moneySchema = z
  .number()
  .finite()
  .min(0, "Debe ser mayor o igual a 0")
  .refine(maxTwoDecimals, "Usa máximo 2 decimales");

const taxPercentSchema = z
  .number()
  .finite()
  .min(0, "Debe ser mayor o igual a 0")
  .max(100, "Usa un valor entre 0 y 100")
  .refine(maxFourDecimals, "Usa máximo 4 decimales");

const stockSchema = z
  .number()
  .int("Debe ser un número entero")
  .min(0, "Debe ser mayor o igual a 0");

export const productFormSchema = z.object({
  barcode: z.string().trim().max(64, "Máximo 64 caracteres"),
  categoryId: z.string().trim().max(128, "Máximo 128 caracteres"),
  cost: moneySchema.nullable(),
  description: z.string().trim().max(500, "Máximo 500 caracteres"),
  imageUrl: z.union([
    z.string().trim().url("URL inválida").max(500, "Máximo 500 caracteres"),
    z.literal(""),
  ]),
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(160, "Máximo 160 caracteres"),
  price: moneySchema,
  sku: z
    .string()
    .trim()
    .min(1, "El SKU es obligatorio")
    .max(64, "Máximo 64 caracteres"),
  stock: stockSchema,
  taxPercent: taxPercentSchema,
});

export type ProductFormData = z.infer<typeof productFormSchema>;

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();

  return trimmed || null;
}

export const defaultProductFormValues: ProductFormData = {
  barcode: "",
  categoryId: "",
  cost: null,
  description: "",
  imageUrl: "",
  name: "",
  price: 0,
  sku: "",
  stock: 0,
  taxPercent: 0,
};

export function productToFormData(product: Product): ProductFormData {
  return {
    barcode: product.barcode ?? "",
    categoryId: product.categoryId ?? "",
    cost: product.cost,
    description: product.description ?? "",
    imageUrl: product.imageUrl ?? "",
    name: product.name,
    price: product.price,
    sku: product.sku,
    stock: product.totalStock,
    taxPercent: Math.round(product.taxRate * 100 * 1e4) / 1e4,
  };
}

export function productFormToPayload(data: ProductFormData): ProductPayload {
  return {
    barcode: emptyToNull(data.barcode),
    categoryId: emptyToNull(data.categoryId),
    cost: data.cost,
    description: emptyToNull(data.description),
    imageUrl: emptyToNull(data.imageUrl),
    name: data.name.trim(),
    price: data.price,
    sku: data.sku.trim(),
    stock: data.stock,
    taxRate: Number((data.taxPercent / 100).toFixed(4)),
  };
}
