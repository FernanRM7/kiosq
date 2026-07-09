import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteProduct } from "@/hooks/mutations/use-delete-product";
import type { Product } from "@/lib/products";

interface DeleteProductDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (product: Product) => void;
}

export function DeleteProductDialog({
  product,
  open,
  onOpenChange,
  onDelete,
}: DeleteProductDialogProps) {
  const deleteMutation = useDeleteProduct();

  const handleDelete = () => {
    if (!product) {
      return;
    }

    deleteMutation.mutate(product.id, {
      onSuccess: () => {
        onDelete(product);
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar Producto</DialogTitle>
          <DialogDescription>
            ¿Estás seguro de que deseas eliminar{" "}
            <span className="font-medium text-foreground">{product?.name}</span>
            ? El producto se desactivará sin borrar su historial de inventario.
          </DialogDescription>
        </DialogHeader>
        {deleteMutation.error && (
          <p className="text-destructive text-sm">
            {deleteMutation.error instanceof Error
              ? deleteMutation.error.message
              : "No se pudo eliminar el producto"}
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
