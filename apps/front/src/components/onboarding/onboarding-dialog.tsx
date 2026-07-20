import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
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

async function readFileAsDataUrl(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x80_00;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCodePoint(...bytes.subarray(index, index + chunkSize));
  }

  return `data:${file.type};base64,${globalThis.btoa(binary)}`;
}

export function OnboardingDialog({
  open: controlledOpen,
  onComplete,
}: OnboardingDialogProps) {
  const navigate = useNavigate();
  const createTenantMutation = useCreateTenant();
  const [internalOpen, setInternalOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string | null>(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  function close() {
    setError(null);
    setLogoPreview(null);
    setLogoName(null);

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
      setError("El nombre del área de trabajo es obligatorio");
      return;
    }

    createTenantMutation.mutate(
      {
        logoUrl: logoPreview ?? undefined,
        name: workspaceName.trim(),
      },
      {
        onSuccess: (result) => {
          setLogoPreview(null);
          setLogoName(null);

          if (onComplete) {
            onComplete(result.tenant.name);
          } else {
            setInternalOpen(false);
            navigate("/dashboard");
          }
        },
      }
    );
  }

  async function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    setError(null);

    const file = event.target.files?.[0];

    if (!file) {
      setLogoPreview(null);
      setLogoName(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Selecciona un archivo de imagen válido");
      event.target.value = "";
      return;
    }

    if (file.size > 3_000_000) {
      setError("El logo debe pesar menos de 3 MB");
      event.target.value = "";
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setLogoPreview(dataUrl);
      setLogoName(file.name);
    } catch (readError) {
      setError(
        readError instanceof Error
          ? readError.message
          : "No se pudo cargar la imagen"
      );
      event.target.value = "";
    }
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
          <DialogTitle>Nuevo área de trabajo</DialogTitle>
          <DialogDescription>
            Configura tu área de trabajo para comenzar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <label htmlFor="workspaceLogo" className="block shrink-0">
              {logoPreview ? (
                <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-2">
                  <img
                    src={logoPreview}
                    alt="Vista previa del logo del área de trabajo"
                    className="h-full w-full rounded-lg object-cover"
                  />
                </div>
              ) : (
                <Empty
                  title="Logo del área de trabajo"
                  description="Haz clic para subir una imagen"
                  className="h-32 w-32 shrink-0 cursor-pointer p-4"
                />
              )}
            </label>
            <Input
              accept="image/*"
              className="sr-only"
              id="workspaceLogo"
              name="workspaceLogo"
              type="file"
              onChange={handleLogoChange}
            />
            <div className="flex flex-1 flex-col items-center gap-2">
              <Label htmlFor="workspaceName" className="text-center">
                Nombre del área de trabajo
              </Label>
              <Input
                id="workspaceName"
                name="workspaceName"
                placeholder="Mi área de trabajo"
                className="text-center"
              />
              <p className="text-center text-muted-foreground text-xs">
                {logoName
                  ? `Logo seleccionado: ${logoName}`
                  : "PNG, JPG o WEBP. Opcional."}
              </p>
            </div>
          </div>
          {(error || createTenantMutation.error) && (
            <p className="text-center text-sm text-red-500">
              {error ??
                (createTenantMutation.error instanceof Error
                  ? createTenantMutation.error.message
                  : "Error al crear el área de trabajo")}
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
                : "Crear área de trabajo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
