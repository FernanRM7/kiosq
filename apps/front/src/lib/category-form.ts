import { z } from "zod";

import type { Category, CategoryPayload } from "@/lib/categories";

export const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(160, "Máximo 160 caracteres"),
});

export type CategoryFormData = z.infer<typeof categoryFormSchema>;

export const defaultCategoryFormValues: CategoryFormData = {
  name: "",
};

export function categoryToFormData(category: Category): CategoryFormData {
  return {
    name: category.name,
  };
}

export function categoryFormToPayload(data: CategoryFormData): CategoryPayload {
  return {
    name: data.name.trim(),
  };
}
