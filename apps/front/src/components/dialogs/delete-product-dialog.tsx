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
import type { Product } from "@/lib/products";
import { deleteProduct as deleteProductRequest } from "@/lib/products";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!product) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await deleteProductRequest(product.id);
      onDelete(product);
      onOpenChange(false);
    } catch (deleteError) {
      console.error("[DeleteProduct] Failed to delete product", deleteError);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el producto"
      );
    } finally {
      setLoading(false);
    }
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
