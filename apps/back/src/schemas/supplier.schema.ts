import { z } from "zod";

const optionalTextField = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const phoneRegex = /^[\d\s\-+()]{7,20}$/u;
const rfcRegex = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/u;

export const SupplierIdParamsSchema = z.object({
  id: z.string().trim().min(1, "El ID del proveedor es obligatorio"),
});

export const CreateSupplierSchema = z.object({
  address: optionalTextField(300),
  email: z
    .string()
    .trim()
    .email("El email no es válido")
    .max(255)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(160, "El nombre debe tener máximo 160 caracteres"),
  phone: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || phoneRegex.test(v),
      "Formato de teléfono inválido"
    )
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  rfc: z
    .string()
    .trim()
    .toUpperCase()
    .max(13, "El RFC debe tener máximo 13 caracteres")
    .refine((v) => v === "" || rfcRegex.test(v), "Formato de RFC inválido")
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});

export const UpdateSupplierSchema = CreateSupplierSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "Envía al menos un campo para actualizar"
);

export type SupplierIdParams = z.infer<typeof SupplierIdParamsSchema>;
export type CreateSupplierInput = z.infer<typeof CreateSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof UpdateSupplierSchema>;
