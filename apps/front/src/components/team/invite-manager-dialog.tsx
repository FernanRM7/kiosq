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
import { useCreateManager } from "@/hooks/mutations/use-create-manager";
import { useAuth } from "@/hooks/use-auth";
import { canManageSettings } from "@/lib/access";

interface InviteManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteManagerDialog({
  open,
  onOpenChange,
}: InviteManagerDialogProps) {
  const { user } = useAuth();
  const canManage = canManageSettings(user?.role);
  const createManager = useCreateManager();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!canManage) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
      setError("Debes proporcionar un email válido");
      return;
    }

    try {
      await createManager.mutateAsync({ email: email.trim() });
      setEmail("");
      onOpenChange(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo crear el manager",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar Manager</DialogTitle>
          <DialogDescription>
            El manager recibirá un enlace para registrarse en WorkOS y accederá
            al workspace con el rol de Dueño.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="manager-email">Correo electrónico</Label>
            <Input
              id="manager-email"
              type="email"
              placeholder="ejemplo@correo.com"
              disabled={createManager.isPending}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={createManager.isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createManager.isPending}>
              {createManager.isPending ? "Creando..." : "Invitar Manager"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
