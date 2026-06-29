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
import type { Category } from "@/lib/categories";
import { createCategory, CATEGORIES_CHANGED_EVENT } from "@/lib/categories";
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
  const [name, setName] = useState(defaultCategoryFormValues.name);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setName("");
    setError(null);
    setFieldError(null);
    onOpenChange(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldError(null);

    const parsed = categoryFormSchema.safeParse({ name });

    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Nombre inválido");
      return;
    }

    setLoading(true);

    try {
      const category = await createCategory(categoryFormToPayload(parsed.data));
      window.dispatchEvent(new CustomEvent(CATEGORIES_CHANGED_EVENT));
      onCreated?.(category);
      handleClose();
    } catch (submitError) {
      console.error("[CreateCategory] Failed to create category", submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo crear la categoría"
      );
    } finally {
      setLoading(false);
    }
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
              disabled={loading}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            {fieldError && (
              <p className="text-destructive text-sm">{fieldError}</p>
            )}
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={handleClose}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
