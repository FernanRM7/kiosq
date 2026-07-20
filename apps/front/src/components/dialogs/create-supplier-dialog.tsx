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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateSupplier } from "@/hooks/mutations/use-create-supplier";
import {
  defaultSupplierFormValues,
  supplierFormSchema,
  supplierFormToPayload,
} from "@/lib/supplier-form";
import type { Supplier } from "@/lib/suppliers";

interface CreateSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (supplier: Supplier) => void;
}

export function CreateSupplierDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateSupplierDialogProps) {
  const createSupplierMutation = useCreateSupplier();
  const [form, setForm] = useState(defaultSupplierFormValues);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleClose = () => {
    setForm(defaultSupplierFormValues);
    setFieldError(null);
    onOpenChange(false);
  };

  const updateField =
    (field: keyof typeof defaultSupplierFormValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFieldError(null);

    const parsed = supplierFormSchema.safeParse(form);

    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }

    createSupplierMutation.mutate(supplierFormToPayload(parsed.data), {
      onSuccess: (supplier) => {
        onCreated?.(supplier);
        handleClose();
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          onOpenChange(true);
        } else {
          handleClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo Proveedor</DialogTitle>
          <DialogDescription>
            Agrega un proveedor al catálogo del negocio.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="create-supplier-name">Nombre *</Label>
            <Input
              id="create-supplier-name"
              placeholder="Ej. Proveedor X"
              disabled={createSupplierMutation.isPending}
              value={form.name}
              onChange={updateField("name")}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="create-supplier-rfc">RFC</Label>
            <Input
              id="create-supplier-rfc"
              placeholder="Ej. ABC123456XYZ"
              disabled={createSupplierMutation.isPending}
              value={form.rfc}
              onChange={(event) => {
                setForm((prev) => ({
                  ...prev,
                  rfc: event.target.value.toUpperCase(),
                }));
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="create-supplier-email">Email</Label>
            <Input
              id="create-supplier-email"
              placeholder="Ej. contacto@proveedor.com"
              disabled={createSupplierMutation.isPending}
              type="email"
              value={form.email}
              onChange={updateField("email")}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="create-supplier-phone">Teléfono</Label>
            <Input
              id="create-supplier-phone"
              placeholder="Ej. +525512345678"
              disabled={createSupplierMutation.isPending}
              value={form.phone}
              onChange={updateField("phone")}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="create-supplier-address">Dirección</Label>
            <Textarea
              id="create-supplier-address"
              placeholder="Ej. Calle Falsa 123, Ciudad"
              disabled={createSupplierMutation.isPending}
              rows={3}
              value={form.address}
              onChange={updateField("address")}
            />
          </div>

          {fieldError && (
            <p className="text-destructive text-sm">{fieldError}</p>
          )}

          {createSupplierMutation.error && (
            <p className="text-destructive text-sm">
              {createSupplierMutation.error instanceof Error
                ? createSupplierMutation.error.message
                : "No se pudo crear el proveedor"}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={createSupplierMutation.isPending}
              onClick={handleClose}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createSupplierMutation.isPending}>
              {createSupplierMutation.isPending ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
