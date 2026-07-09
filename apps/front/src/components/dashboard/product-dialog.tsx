import { zodResolver } from "@hookform/resolvers/zod";
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
import { useCreateProduct } from "@/hooks/mutations/use-create-product";
import {
  defaultProductFormValues,
  productFormSchema,
  productFormToPayload,
} from "@/lib/product-form";
import type { ProductFormData } from "@/lib/product-form";

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductDialog({ open, onOpenChange }: ProductDialogProps) {
  const createProductMutation = useCreateProduct();
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

  const onSubmit = (data: ProductFormData) => {
    createProductMutation.mutate(productFormToPayload(data), {
      onSuccess: () => {
        reset(defaultProductFormValues);
        onOpenChange(false);
      },
    });
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
            disabled={createProductMutation.isPending}
            errors={errors}
            idPrefix="create-product"
            register={register}
          />
          {createProductMutation.error && (
            <p className="text-destructive text-sm">
              {createProductMutation.error instanceof Error
                ? createProductMutation.error.message
                : "No se pudo crear el producto"}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={createProductMutation.isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createProductMutation.isPending}>
              {createProductMutation.isPending
                ? "Guardando..."
                : "Agregar producto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
