import { z } from "zod";

const paymentMethodSchema = z.enum([
  "CASH",
  "CARD",
  "TRANSFER",
  "QR",
  "CREDIT",
]);

const saleItemSchema = z.object({
  productId: z.string().trim().min(1, "El productId es obligatorio"),
  quantity: z.coerce.number().int().min(1, "La cantidad debe ser al menos 1"),
});

export const CreateSaleSchema = z.object({
  branchId: z.string().trim().optional(),
  items: z
    .array(saleItemSchema)
    .min(1, "Agrega al menos un producto a la venta"),
  paymentMethod: paymentMethodSchema,
});

export type CreateSaleInput = z.infer<typeof CreateSaleSchema>;
