import { z } from "zod";

export const CashierLoginSchema = z.object({
  cashierCode: z
    .string()
    .trim()
    .min(3, "El código del cajero es obligatorio")
    .max(32, "El código del cajero debe tener máximo 32 caracteres"),
  pin: z
    .string()
    .trim()
    .min(4, "La contraseña del cajero es obligatoria")
    .max(12, "La contraseña del cajero debe tener máximo 12 caracteres"),
  tenantSlug: z
    .string()
    .trim()
    .min(2, "El negocio es obligatorio")
    .max(120, "El negocio debe tener máximo 120 caracteres"),
});

export type CashierLoginInput = z.infer<typeof CashierLoginSchema>;
