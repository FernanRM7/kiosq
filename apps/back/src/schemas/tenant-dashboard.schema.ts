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

export const UpdateCashierSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "El nombre del cajero es obligatorio")
      .max(160, "El nombre debe tener máximo 160 caracteres")
      .optional(),
    pin: z
      .string()
      .trim()
      .min(4, "La contraseña debe tener al menos 4 caracteres")
      .max(12, "La contraseña debe tener máximo 12 caracteres")
      .optional(),
  })
  .refine(
    (value) => value.name !== undefined || value.pin !== undefined,
    "Debes actualizar el nombre o la contraseña"
  );

export type UpdateTenantSettingsInput = z.infer<
  typeof UpdateTenantSettingsSchema
>;
export type CreateCashierInput = z.infer<typeof CreateCashierSchema>;
export type UpdateCashierInput = z.infer<typeof UpdateCashierSchema>;
