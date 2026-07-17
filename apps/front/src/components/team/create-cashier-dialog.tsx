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
import { useCreateCashier } from "@/hooks/mutations/use-create-cashier";
import { useAuth } from "@/hooks/use-auth";
import { canManageSettings } from "@/lib/access";

interface CreateCashierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCashierDialog({
  open,
  onOpenChange,
}: CreateCashierDialogProps) {
  const { user } = useAuth();
  const canManage = canManageSettings(user?.role);
  const createCashier = useCreateCashier();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!canManage) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }

    if (!/^\d{4,6}$/.test(pin)) {
      setError("El PIN debe tener 4-6 dígitos numéricos");
      return;
    }

    try {
      await createCashier.mutateAsync({ name: name.trim(), pin });
      setName("");
      setPin("");
      onOpenChange(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo crear la cuenta de dependiente",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar Dependiente</DialogTitle>
          <DialogDescription>
            Crea una cuenta de cajero con acceso por PIN. El dependiente
            recibirá sus credenciales de parte del administrador.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="cashier-name">Nombre</Label>
            <Input
              id="cashier-name"
              placeholder="Ej. Juan Pérez"
              disabled={createCashier.isPending}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cashier-pin">PIN (4-6 dígitos)</Label>
            <Input
              id="cashier-pin"
              type="password"
              placeholder="1234"
              maxLength={6}
              disabled={createCashier.isPending}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={createCashier.isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createCashier.isPending}>
              {createCashier.isPending ? "Creando..." : "Crear Dependiente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
