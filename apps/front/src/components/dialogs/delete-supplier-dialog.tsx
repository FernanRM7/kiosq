import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteSupplier } from "@/hooks/mutations/use-delete-supplier";
import type { Supplier } from "@/lib/suppliers";

interface DeleteSupplierDialogProps {
  supplier: Supplier | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (supplier: Supplier) => void;
}

export function DeleteSupplierDialog({
  supplier,
  open,
  onOpenChange,
  onDelete,
}: DeleteSupplierDialogProps) {
  const deleteMutation = useDeleteSupplier();

  const handleDelete = () => {
    if (!supplier) {
      return;
    }

    deleteMutation.mutate(supplier.id, {
      onSuccess: () => {
        onDelete(supplier);
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar Proveedor</DialogTitle>
          <DialogDescription>
            ¿Estás seguro de que deseas eliminar{" "}
            <span className="font-medium text-foreground">
              {supplier?.name}
            </span>
            ? El proveedor se desactivará y dejará de estar disponible.
          </DialogDescription>
        </DialogHeader>
        {deleteMutation.error && (
          <p className="text-destructive text-sm">
            {deleteMutation.error instanceof Error
              ? deleteMutation.error.message
              : "No se pudo eliminar el proveedor"}
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
