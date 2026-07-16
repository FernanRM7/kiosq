import { z } from "zod";

export const SupplierIdParamsSchema = z.object({
  id: z.string().trim().min(1, "El ID del proveedor es obligatorio"),
});

export const CreateSupplierSchema = z.object({
  address: z
    .string()
    .trim()
    .max(300, "La dirección debe tener máximo 300 caracteres")
    .optional(),
  email: z.string().trim().email("El email no es válido").max(255).optional(),
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(160, "El nombre debe tener máximo 160 caracteres"),
  phone: z
    .string()
    .trim()
    .max(20, "El teléfono debe tener máximo 20 caracteres")
    .optional(),
  rfc: z
    .string()
    .trim()
    .max(13, "El RFC debe tener máximo 13 caracteres")
    .optional(),
});

export const UpdateSupplierSchema = CreateSupplierSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "Envía al menos un campo para actualizar"
);

export type SupplierIdParams = z.infer<typeof SupplierIdParamsSchema>;
export type CreateSupplierInput = z.infer<typeof CreateSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof UpdateSupplierSchema>;
