import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteCategory } from "@/hooks/mutations/use-delete-category";
import { useAuth } from "@/hooks/use-auth";
import { canManageCatalog } from "@/lib/access";
import type { Category } from "@/lib/categories";

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
  const deleteMutation = useDeleteCategory();
  const { user } = useAuth();
  const canDeleteCategory = canManageCatalog(user?.role);

  if (!canDeleteCategory) {
    return null;
  }

  const handleDelete = () => {
    if (!category) {
      return;
    }

    deleteMutation.mutate(category.id, {
      onSuccess: () => {
        onDelete(category);
        onOpenChange(false);
      },
    });
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
        {deleteMutation.error && (
          <p className="text-destructive text-sm">
            {deleteMutation.error instanceof Error
              ? deleteMutation.error.message
              : "No se pudo eliminar la categoría"}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={deleteMutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={handleDelete}
          >
            {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
