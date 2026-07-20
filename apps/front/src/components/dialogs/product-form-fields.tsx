import { Controller } from "react-hook-form";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCategories } from "@/hooks/queries/use-categories";
import { useMyTenant } from "@/hooks/queries/use-tenants";
import type { ProductFormData } from "@/lib/product-form";
import { cn } from "@/lib/utils";

interface ProductFormFieldsProps {
  control: Control<ProductFormData>;
  disabled: boolean;
  errors: FieldErrors<ProductFormData>;
  idPrefix: string;
  register: UseFormRegister<ProductFormData>;
}

// eslint-disable-next-line complexity
export function ProductFormFields({
  control,
  disabled,
  errors,
  idPrefix,
  register,
}: ProductFormFieldsProps) {
  const { data: myTenant } = useMyTenant();
  const hasTenant = Boolean(myTenant?.tenant);
  const { data: categories = { active: [], deleted: [] } } = useCategories({
    enabled: hasTenant,
  });

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
            step="1"
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
            step="1"
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
          <Label htmlFor={`${idPrefix}-categoryId`}>Categoría</Label>
          <Controller
            name="categoryId"
            control={control}
            render={({ field }) => (
              <select
                id={`${idPrefix}-categoryId`}
                disabled={disabled}
                value={field.value}
                onChange={(event) => field.onChange(event)}
                ref={field.ref}
                className={cn(
                  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  "aria-invalid:border-destructive aria-invalid:ring-destructive/20"
                )}
              >
                <option value="">Sin categoría</option>
                {categories.active.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            )}
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
