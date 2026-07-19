import { z } from "zod";

export const UpdateTenantSettingsSchema = z.object({
  cashOpeningAmount: z.coerce
    .number()
    .finite("El fondo inicial debe ser un número válido")
    .min(0, "El fondo inicial no puede ser negativo")
    .refine(
      (value) => Number.isInteger(value * 100),
      "El fondo inicial debe tener máximo dos decimales"
    ),
});

export const CreateCashierSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre del cajero es obligatorio")
    .max(160, "El nombre debe tener máximo 160 caracteres"),
});

export type UpdateTenantSettingsInput = z.infer<
  typeof UpdateTenantSettingsSchema
>;
export type CreateCashierInput = z.infer<typeof CreateCashierSchema>;
