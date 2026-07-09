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
import { useCreateCategory } from "@/hooks/mutations/use-create-category";
import type { Category } from "@/lib/categories";
import {
  categoryFormSchema,
  categoryFormToPayload,
  defaultCategoryFormValues,
} from "@/lib/category-form";

interface CreateCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (category: Category) => void;
}

export function CreateCategoryDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateCategoryDialogProps) {
  const createCategoryMutation = useCreateCategory();
  const [name, setName] = useState(defaultCategoryFormValues.name);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleClose = () => {
    setName("");
    setFieldError(null);
    onOpenChange(false);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFieldError(null);

    const parsed = categoryFormSchema.safeParse({ name });

    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Nombre inválido");
      return;
    }

    createCategoryMutation.mutate(categoryFormToPayload(parsed.data), {
      onSuccess: (category) => {
        onCreated?.(category);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva Categoría</DialogTitle>
          <DialogDescription>
            Crea una categoría para organizar los productos del catálogo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="create-category-name">Nombre</Label>
            <Input
              id="create-category-name"
              placeholder="Ej. Bebidas"
              disabled={createCategoryMutation.isPending}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            {fieldError && (
              <p className="text-destructive text-sm">{fieldError}</p>
            )}
          </div>

          {createCategoryMutation.error && (
            <p className="text-destructive text-sm">
              {createCategoryMutation.error instanceof Error
                ? createCategoryMutation.error.message
                : "No se pudo crear la categoría"}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={createCategoryMutation.isPending}
              onClick={handleClose}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createCategoryMutation.isPending}>
              {createCategoryMutation.isPending ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
