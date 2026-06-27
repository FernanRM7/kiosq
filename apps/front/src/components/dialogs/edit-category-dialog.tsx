import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Category } from "@/lib/categories";
import { updateCategory, CATEGORIES_CHANGED_EVENT } from "@/lib/categories";
import {
  categoryFormSchema,
  categoryFormToPayload,
  categoryToFormData,
  defaultCategoryFormValues,
} from "@/lib/category-form";
import type { CategoryFormData } from "@/lib/category-form";

interface EditCategoryDialogProps {
  category: Category | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (category: Category) => void;
}

export function EditCategoryDialog({
  category,
  open,
  onOpenChange,
  onSave,
}: EditCategoryDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryFormData>({
    defaultValues: defaultCategoryFormValues,
    resolver: zodResolver(categoryFormSchema),
  });

  useEffect(() => {
    if (category) {
      reset(categoryToFormData(category));
      setError(null);
    }
  }, [category, reset]);

  const onSubmit = async (data: CategoryFormData) => {
    if (!category) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const updatedCategory = await updateCategory(
        category.id,
        categoryFormToPayload(data)
      );
      window.dispatchEvent(new CustomEvent(CATEGORIES_CHANGED_EVENT));
      onSave(updatedCategory);
      onOpenChange(false);
    } catch (submitError) {
      console.error("[EditCategory] Failed to update category", submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo actualizar la categoría"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Categoría</DialogTitle>
          <DialogDescription>
            Modifica el nombre de la categoría {category?.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-category-name">Nombre</Label>
            <Input
              id="edit-category-name"
              placeholder="Ej. Bebidas"
              disabled={loading}
              {...register("name")}
            />
            {errors.name?.message && (
              <p className="text-destructive text-sm">{errors.name.message}</p>
            )}
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
