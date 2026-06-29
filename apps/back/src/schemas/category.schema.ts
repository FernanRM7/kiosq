import { z } from "zod";

export const CategoryIdParamsSchema = z.object({
  id: z.string().trim().min(1, "El ID de la categoría es obligatorio"),
});

export const CreateCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(160, "El nombre debe tener máximo 160 caracteres"),
});

export const UpdateCategorySchema = CreateCategorySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "Envía al menos un campo para actualizar"
);

export type CategoryIdParams = z.infer<typeof CategoryIdParamsSchema>;
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
