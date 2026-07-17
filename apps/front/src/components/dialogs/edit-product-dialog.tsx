import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
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
import { useAuth } from "@/hooks/use-auth";
import { canManageCatalog } from "@/lib/access";
import {
  defaultProductFormValues,
  productFormSchema,
  productFormToPayload,
  productToFormData,
} from "@/lib/product-form";
import type { ProductFormData } from "@/lib/product-form";
import type { Product } from "@/lib/products";
import { updateProduct } from "@/lib/products";

interface EditProductDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (product: Product) => void;
}

export function EditProductDialog({
  product,
  open,
  onOpenChange,
  onSave,
}: EditProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const canEditProduct = canManageCatalog(user?.role);
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

  useEffect(() => {
    if (product) {
      reset(productToFormData(product));
      setError(null);
    }
  }, [product, reset]);

  const onSubmit = async (data: ProductFormData) => {
    if (!product) {
      return;
    }

    if (!canEditProduct) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const updatedProduct = await updateProduct(
        product.id,
        productFormToPayload(data)
      );
      onSave(updatedProduct);
      onOpenChange(false);
    } catch (submitError) {
      console.error("[EditProduct] Failed to update product", submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo actualizar el producto"
      );
    } finally {
      setLoading(false);
    }
  };

  return canEditProduct ? (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar Producto</DialogTitle>
          <DialogDescription>
            Modifica los detalles del producto {product?.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <ProductFormFields
            control={control}
            disabled={loading}
            errors={errors}
            idPrefix="edit-product"
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
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  ) : null;
}
