import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateTenant } from "@/hooks/mutations/use-create-tenant";

interface OnboardingDialogProps {
  open?: boolean;
  onComplete?: (tenantName: string) => void;
}

export function OnboardingDialog({
  open: controlledOpen,
  onComplete,
}: OnboardingDialogProps) {
  const navigate = useNavigate();
  const createTenantMutation = useCreateTenant();
  const [internalOpen, setInternalOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  function close() {
    if (isControlled) {
      onComplete?.("");
    } else {
      setInternalOpen(false);
      navigate("/dashboard");
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const form = e.target as HTMLFormElement;
    const data = new FormData(form);
    const workspaceName = data.get("workspaceName") as string;

    if (!workspaceName?.trim()) {
      setError("El nombre del local es obligatorio");
      return;
    }

    createTenantMutation.mutate(workspaceName.trim(), {
      onSuccess: (result) => {
        if (onComplete) {
          onComplete(result.tenant.name);
        } else {
          setInternalOpen(false);
          navigate("/dashboard");
        }
      },
    });
  }

  function handleOpenChange(isOpen: boolean) {
    if (!createTenantMutation.isPending && !isOpen) {
      close();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo Workspace</DialogTitle>
          <DialogDescription>
            Configura tu espacio de trabajo para comenzar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="flex items-center gap-4">
            <Empty
              title="Logo"
              description="Click to upload"
              className="h-32 w-32 shrink-0 cursor-pointer p-4"
            />
            <div className="flex flex-1 flex-col items-center gap-2">
              <Label htmlFor="workspaceName" className="text-center">
                Nombre del Local
              </Label>
              <Input
                id="workspaceName"
                name="workspaceName"
                placeholder="Mi Local"
                className="text-center"
              />
            </div>
          </div>
          {(error || createTenantMutation.error) && (
            <p className="text-sm text-red-500 text-center">
              {error ??
                (createTenantMutation.error instanceof Error
                  ? createTenantMutation.error.message
                  : "Error al crear el workspace")}
            </p>
          )}
          <DialogFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={createTenantMutation.isPending}
            >
              {createTenantMutation.isPending
                ? "Creando..."
                : "Crear Workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
