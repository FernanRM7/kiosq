import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
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
import { useUpdateCategory } from "@/hooks/mutations/use-update-category";
import { useAuth } from "@/hooks/use-auth";
import { canManageCatalog } from "@/lib/access";
import type { Category } from "@/lib/categories";
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
  const updateCategoryMutation = useUpdateCategory();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const canEditCategory = canManageCatalog(user?.role);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categoryFormSchema),
    values: category ? categoryToFormData(category) : defaultCategoryFormValues,
  });

  const onSubmit = async (data: CategoryFormData) => {
    if (!category) {
      return;
    }

    if (!canEditCategory) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const updatedCategory = await updateCategoryMutation.mutateAsync({
        categoryId: category.id,
        payload: categoryFormToPayload(data),
      });
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

  return canEditCategory ? (
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
  ) : null;
}
