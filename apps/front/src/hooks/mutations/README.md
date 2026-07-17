# Mutations

## Convenciones

### Nombrado de archivos

Cada mutación vive en un hook con el patrón `use-<accion>-<recurso>.ts`:

```
hooks/mutations/
├── README.md
├── use-create-category.ts
├── use-create-product.ts
├── use-create-sale.ts
├── use-create-tenant.ts
├── use-delete-category.ts
├── use-delete-product.ts
├── use-restore-category.ts
├── use-update-category.ts
├── use-update-product.ts
└── use-revoke-session.ts
```

### Estructura

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createProduct } from "@/lib/products";

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
```

### Reglas

1. Toda mutación que modifica datos del servidor debe invalidar los `queryKey` afectados en `onSuccess`. No usar `window.dispatchEvent`.
2. Si la mutación afecta múltiples recursos (ej. crear venta afecta products y sales), invalidar ambos queryKeys en el mismo `onSuccess`.
3. El hook de mutación exporta el resultado completo de `useMutation` (incluye `mutate`, `mutateAsync`, `isPending`, `error`, etc.).
4. No agregues lógica de negocio en `onSuccess` más allá de invalidar queries. La actualización optimista del cache se evalúa caso a caso.
5. Si la mutación necesita el `queryClient` pero el hook no está dentro de un componente (caso raro), importa `queryClient` desde `@/lib/query-client` directamente en vez de usar `useQueryClient`.
