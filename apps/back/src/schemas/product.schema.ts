import { z } from "zod";

const maxTwoDecimals = (value: number) =>
  Number.isInteger(Math.round(value * 100) - value * 100);

const maxFourDecimals = (value: number) =>
  Number.isInteger(Math.round(value * 10_000) - value * 10_000);

const moneySchema = z.coerce
  .number()
  .finite()
  .min(0)
  .refine(maxTwoDecimals, "Debe tener máximo 2 decimales");

const taxRateSchema = z.coerce
  .number()
  .finite()
  .min(0)
  .max(1)
  .refine(maxFourDecimals, "Debe tener máximo 4 decimales");

const optionalTextSchema = (max: number) =>
  z.string().trim().max(max).nullable().optional();

export const ProductIdParamsSchema = z.object({
  id: z.string().trim().min(1, "El ID del producto es obligatorio"),
});

export const CreateProductSchema = z.object({
  barcode: optionalTextSchema(64),
  categoryId: optionalTextSchema(128),
  cost: moneySchema.nullable().optional(),
  description: optionalTextSchema(500),
  imageUrl: z.string().trim().url().max(500).nullable().optional(),
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(160),
  price: moneySchema,
  sku: z.string().trim().min(1, "El SKU es obligatorio").max(64),
  taxRate: taxRateSchema.optional(),
});

export const UpdateProductSchema = CreateProductSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "Envía al menos un campo para actualizar"
);

export type ProductIdParams = z.infer<typeof ProductIdParamsSchema>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
