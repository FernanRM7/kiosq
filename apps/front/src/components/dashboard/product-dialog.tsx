import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { ProductFormFields } from "@/components/dialogs/product-form-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  defaultProductFormValues,
  productFormSchema,
  productFormToPayload,
} from "@/lib/product-form";
import type { ProductFormData } from "@/lib/product-form";
import { createProduct, PRODUCTS_CHANGED_EVENT } from "@/lib/products";

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductDialog({ open, onOpenChange }: ProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { errors },
  } = useForm<ProductFormData>({
    defaultValues: defaultProductFormValues,
    resolver: zodResolver(productFormSchema),
  });

  const onSubmit = async (data: ProductFormData) => {
    setError(null);
    setLoading(true);

    try {
      await createProduct(productFormToPayload(data));
      window.dispatchEvent(new Event(PRODUCTS_CHANGED_EVENT));
      reset(defaultProductFormValues);
      onOpenChange(false);
    } catch (submitError) {
      console.error("[ProductDialog] Failed to create product", submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo crear el producto"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Agregar producto</DialogTitle>
          <DialogDescription>
            Captura los datos del catálogo. El inventario se gestiona por
            separado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <ProductFormFields
            control={control}
            disabled={loading}
            errors={errors}
            idPrefix="create-product"
            register={register}
          />
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
              {loading ? "Guardando..." : "Agregar producto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
