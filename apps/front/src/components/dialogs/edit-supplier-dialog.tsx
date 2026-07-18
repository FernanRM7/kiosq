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
import { Textarea } from "@/components/ui/textarea";
import { useUpdateSupplier } from "@/hooks/mutations/use-update-supplier";
import {
  defaultSupplierFormValues,
  supplierFormSchema,
  supplierFormToPayload,
  supplierToFormData,
} from "@/lib/supplier-form";
import type { SupplierFormData } from "@/lib/supplier-form";
import type { Supplier } from "@/lib/suppliers";

interface EditSupplierDialogProps {
  supplier: Supplier | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (supplier: Supplier) => void;
}

export function EditSupplierDialog({
  supplier,
  open,
  onOpenChange,
  onSave,
}: EditSupplierDialogProps) {
  const updateSupplierMutation = useUpdateSupplier();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupplierFormData>({
    defaultValues: defaultSupplierFormValues,
    resolver: zodResolver(supplierFormSchema),
  });

  useEffect(() => {
    if (supplier) {
      reset(supplierToFormData(supplier));
      setError(null);
    }
  }, [supplier, reset]);

  const onSubmit = async (data: SupplierFormData) => {
    if (!supplier) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const updatedSupplier = await updateSupplierMutation.mutateAsync({
        payload: supplierFormToPayload(data),
        supplierId: supplier.id,
      });
      onSave(updatedSupplier);
      onOpenChange(false);
    } catch (submitError) {
      console.error("[EditSupplier] Failed to update supplier", submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo actualizar el proveedor"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Proveedor</DialogTitle>
          <DialogDescription>
            Modifica los datos de {supplier?.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-supplier-name">Nombre *</Label>
            <Input
              id="edit-supplier-name"
              placeholder="Ej. Proveedor X"
              disabled={loading}
              {...register("name")}
            />
            {errors.name?.message && (
              <p className="text-destructive text-sm">{errors.name.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-supplier-rfc">RFC</Label>
            <Input
              id="edit-supplier-rfc"
              placeholder="Ej. ABC123456XYZ"
              disabled={loading}
              {...register("rfc")}
              onChange={(event) => {
                event.target.value = event.target.value.toUpperCase();
                register("rfc").onChange(event);
              }}
            />
            {errors.rfc?.message && (
              <p className="text-destructive text-sm">{errors.rfc.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-supplier-email">Email</Label>
            <Input
              id="edit-supplier-email"
              placeholder="Ej. contacto@proveedor.com"
              disabled={loading}
              type="email"
              {...register("email")}
            />
            {errors.email?.message && (
              <p className="text-destructive text-sm">{errors.email.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-supplier-phone">Teléfono</Label>
            <Input
              id="edit-supplier-phone"
              placeholder="Ej. +525512345678"
              disabled={loading}
              {...register("phone")}
            />
            {errors.phone?.message && (
              <p className="text-destructive text-sm">{errors.phone.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-supplier-address">Dirección</Label>
            <Textarea
              id="edit-supplier-address"
              placeholder="Ej. Calle Falsa 123, Ciudad"
              disabled={loading}
              rows={3}
              {...register("address")}
            />
            {errors.address?.message && (
              <p className="text-destructive text-sm">
                {errors.address.message}
              </p>
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
