# Queries

## Convenciones

### Nombrado de archivos

Cada query vive en un hook con el patrón `use-<recurso>.ts`:

```
hooks/queries/
├── README.md
├── use-categories.ts
├── use-me.ts
├── use-products.ts
├── use-sales.ts
├── use-sessions.ts
└── use-tenants.ts
```

### Estructura

```ts
import { useQuery } from "@tanstack/react-query";

import { listProducts } from "@/lib/products";

export function useProducts() {
  return useQuery({
    queryFn: listProducts,
    queryKey: ["products"],
  });
}
```

### Query Keys jerárquicas

Usar arrays planos con nombre de recurso como primer elemento. Si un recurso
tiene variantes (por ID, filtros), agregar elementos adicionales:

```
["products"]             — lista completa
["products", productId]  — detalle por ID
["categories"]           — lista completa (activas + eliminadas)
["sales"]                — lista de ventas
["me"]                   — sesión del usuario actual
["me", "sessions"]       — sesiones activas
["tenants", "me"]        — tenant del usuario actual
["tenants"]              — todos los tenants del usuario
```

### Reglas

1. El `queryKey` siempre se define como array, no como string.
2. Si el endpoint requiere parámetros, estos van en el `queryKey` para
   habilitar cacheo automático por variante.
3. No uses `enabled` a menos que sea estrictamente necesario (ej. query
   condicional que depende de otro dato).
4. El hook de query solo exporta el resultado de `useQuery`. No agregues
   `useState` ni `useEffect` adicionales.
5. Para invalidar queries desde mutaciones, importar `queryClient` desde
   `@/lib/query-client` y usar `queryClient.invalidateQueries`.
