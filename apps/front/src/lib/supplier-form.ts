import { z } from "zod";

import type { Supplier, SupplierPayload } from "@/lib/suppliers";

const phoneRegex = /^[\d\s\-+()]{7,20}$/u;
const rfcRegex = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/u;

export const supplierFormSchema = z.object({
  address: z.string().trim().max(300, "Máximo 300 caracteres"),
  email: z
    .string()
    .trim()
    .max(255)
    .refine(
      (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(v),
      "Email inválido"
    ),
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(160, "Máximo 160 caracteres"),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine(
      (v) => v === "" || phoneRegex.test(v),
      "Formato de teléfono inválido"
    ),
  rfc: z
    .string()
    .trim()
    .toUpperCase()
    .max(13, "Máximo 13 caracteres")
    .refine((v) => v === "" || rfcRegex.test(v), "Formato de RFC inválido"),
});

export type SupplierFormData = z.infer<typeof supplierFormSchema>;

const emptyToNull = (value: string): string | null => {
  const trimmed = value.trim();

  return trimmed || null;
};

export const defaultSupplierFormValues: SupplierFormData = {
  address: "",
  email: "",
  name: "",
  phone: "",
  rfc: "",
};

export function supplierToFormData(supplier: Supplier): SupplierFormData {
  return {
    address: supplier.address ?? "",
    email: supplier.email ?? "",
    name: supplier.name,
    phone: supplier.phone ?? "",
    rfc: supplier.rfc ?? "",
  };
}

export function supplierFormToPayload(data: SupplierFormData): SupplierPayload {
  return {
    address: emptyToNull(data.address),
    email: emptyToNull(data.email),
    name: data.name.trim(),
    phone: emptyToNull(data.phone),
    rfc: emptyToNull(data.rfc),
  };
}
