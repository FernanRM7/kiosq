import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Category } from "@/lib/categories";
import {
  deleteCategory as deleteCategoryRequest,
  CATEGORIES_CHANGED_EVENT,
} from "@/lib/categories";

interface DeleteCategoryDialogProps {
  category: Category | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (category: Category) => void;
}

export function DeleteCategoryDialog({
  category,
  open,
  onOpenChange,
  onDelete,
}: DeleteCategoryDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!category) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await deleteCategoryRequest(category.id);
      window.dispatchEvent(new CustomEvent(CATEGORIES_CHANGED_EVENT));
      onDelete(category);
      onOpenChange(false);
    } catch (deleteError) {
      console.error("[DeleteCategory] Failed to delete category", deleteError);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar la categoría"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar Categoría</DialogTitle>
          <DialogDescription>
            ¿Estás seguro de que deseas eliminar{" "}
            <span className="font-medium text-foreground">
              {category?.name}
            </span>
            ? La categoría se desactivará y dejará de estar disponible para
            asignar a productos. Los productos que la usan conservan su
            asignación hasta que los edites.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={loading}
            onClick={handleDelete}
          >
            {loading ? "Eliminando..." : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
