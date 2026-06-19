import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductFormData } from "@/lib/product-form";

interface ProductFormFieldsProps {
  disabled: boolean;
  errors: FieldErrors<ProductFormData>;
  idPrefix: string;
  register: UseFormRegister<ProductFormData>;
}

// eslint-disable-next-line complexity
export function ProductFormFields({
  disabled,
  errors,
  idPrefix,
  register,
}: ProductFormFieldsProps) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-sku`}>SKU</Label>
        <Input
          id={`${idPrefix}-sku`}
          placeholder="Ej. PROD-001"
          disabled={disabled}
          {...register("sku")}
        />
        {errors.sku?.message && (
          <p className="text-destructive text-sm">{errors.sku.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-name`}>Nombre</Label>
        <Input
          id={`${idPrefix}-name`}
          placeholder="Ej. Café americano"
          disabled={disabled}
          {...register("name")}
        />
        {errors.name?.message && (
          <p className="text-destructive text-sm">{errors.name.message}</p>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-price`}>Precio de venta</Label>
          <Input
            id={`${idPrefix}-price`}
            type="number"
            min="0"
            step="0.01"
            disabled={disabled}
            {...register("price", { valueAsNumber: true })}
          />
          {errors.price?.message && (
            <p className="text-destructive text-sm">{errors.price.message}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-cost`}>Precio de adquisición</Label>
          <Input
            id={`${idPrefix}-cost`}
            type="number"
            min="0"
            step="0.01"
            placeholder="Opcional"
            disabled={disabled}
            {...register("cost", {
              setValueAs: (value: string) =>
                value === "" ? null : Number(value),
            })}
          />
          {errors.cost?.message && (
            <p className="text-destructive text-sm">{errors.cost.message}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-taxPercent`}>Impuesto (%)</Label>
          <Input
            id={`${idPrefix}-taxPercent`}
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="Ej. 8"
            disabled={disabled}
            {...register("taxPercent", { valueAsNumber: true })}
          />
          {errors.taxPercent?.message && (
            <p className="text-destructive text-sm">
              {errors.taxPercent.message}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-stock`}>Stock inicial</Label>
          <Input
            id={`${idPrefix}-stock`}
            type="number"
            min="0"
            step="1"
            disabled={disabled}
            {...register("stock", { valueAsNumber: true })}
          />
          {errors.stock?.message && (
            <p className="text-destructive text-sm">{errors.stock.message}</p>
          )}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-barcode`}>Código de barras</Label>
          <Input
            id={`${idPrefix}-barcode`}
            placeholder="Opcional"
            disabled={disabled}
            {...register("barcode")}
          />
          {errors.barcode?.message && (
            <p className="text-destructive text-sm">{errors.barcode.message}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-categoryId`}>ID de categoría</Label>
          <Input
            id={`${idPrefix}-categoryId`}
            placeholder="Opcional"
            disabled={disabled}
            {...register("categoryId")}
          />
          {errors.categoryId?.message && (
            <p className="text-destructive text-sm">
              {errors.categoryId.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-description`}>Descripción</Label>
        <Input
          id={`${idPrefix}-description`}
          placeholder="Opcional"
          disabled={disabled}
          {...register("description")}
        />
        {errors.description?.message && (
          <p className="text-destructive text-sm">
            {errors.description.message}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-imageUrl`}>URL de imagen</Label>
        <Input
          id={`${idPrefix}-imageUrl`}
          placeholder="https://..."
          disabled={disabled}
          {...register("imageUrl")}
        />
        {errors.imageUrl?.message && (
          <p className="text-destructive text-sm">{errors.imageUrl.message}</p>
        )}
      </div>
    </div>
  );
}
