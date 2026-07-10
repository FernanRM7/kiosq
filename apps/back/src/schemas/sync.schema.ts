import { z } from "zod";

const syncItemSchema = z.object({
  productId: z.string().min(1, "El productId es obligatorio"),
  quantity: z.coerce.number().int().min(1, "La cantidad debe ser al menos 1"),
  subtotal: z.coerce.number().min(0, "El subtotal no puede ser negativo"),
  taxRate: z.coerce.number().min(0, "El taxRate no puede ser negativo"),
  unitPrice: z.coerce.number().min(0, "El unitPrice no puede ser negativo"),
});

const syncPayloadSchema = z.object({
  createdAt: z.string(),
  discountAmount: z.coerce.number().default(0),
  items: z.array(syncItemSchema).min(1, "Agrega al menos un item"),
  offlineId: z.string().min(1, "El offlineId es obligatorio"),
  subtotal: z.coerce.number(),
  taxAmount: z.coerce.number(),
  total: z.coerce.number(),
});

const syncEventSchema = z.object({
  id: z.number(),
  payload: syncPayloadSchema,
  type: z.enum(["CREATE_SALE"]),
});

const syncFailedItemSchema = z.object({
  id: z.number(),
  code: z.string(),
  message: z.string(),
});

export const SyncPushSchema = z.object({
  events: z.array(syncEventSchema).min(1, "Envía al menos un evento"),
});

export const SyncPullQuerySchema = z.object({
  since: z.string().optional(),
});

export type SyncPushInput = z.infer<typeof SyncPushSchema>;
export type SyncPullQueryInput = z.infer<typeof SyncPullQuerySchema>;
export type SyncEventInput = z.infer<typeof syncEventSchema>;
export type SyncPayloadInput = z.infer<typeof syncPayloadSchema>;
export type SyncItemInput = z.infer<typeof syncItemSchema>;
export type SyncFailedItem = z.infer<typeof syncFailedItemSchema>;
