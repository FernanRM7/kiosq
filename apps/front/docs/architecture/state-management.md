# State Management — Kiosq Frontend

> Arquitectura de estado global y fetching en `apps/front`. Última actualización: 2026-07-08.

---

## 1. Principio rector

| Qué | Herramienta | Vive en |
| --- | --- | --- |
| Estado de sesión y UI compartida entre rutas | **Zustand** | `src/stores/` |
| Datos remotos (fetch, cache, mutaciones) | **TanStack Query** | `src/hooks/queries/` y `src/hooks/mutations/` |
| Estado de UI local (formularios, sidebar, charts) | **React Context** / `useState` | Junto al componente que lo consume |

Regla: **si un dato viene de `GET /api/*`, vive en TanStack Query, no en Zustand ni en Context.**

---

## 2. Zustand — Stores

### 2.1 Ubicación

```
src/stores/
├── README.md           # Convenciones de nombrado, slices, middleware
└── auth.store.ts       # Store de sesión (único store global)
```

### 2.2 Qué va en Zustand

- Estado de sesión del usuario (`status`, `user`, `pendingAction`, `error`).
- Acciones que **no son mutaciones REST puras** (login/logout/register redirigen a WorkOS, no retornan datos cacheados por React Query).
- Preferencias de UI compartidas entre rutas (tema dark/light, sidebar colapsado — aunque estas actualmente viven en Context local).

### 2.3 Qué NO va en Zustand

- Listas de productos, categorías, ventas → **TanStack Query**.
- Datos de formularios → **React Hook Form** + `useState` local.
- Estado del drawer de ventas, diálogos → **`useState` local** del componente.

### 2.4 Convención de store

```ts
// src/stores/ejemplo.store.ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";

export const useEjemploStore = create<EjemploState>()(
  devtools(
    (set) => ({
      // estado inicial
      // acciones
    }),
    { name: "ejemplo-store" } // ← nombre para React DevTools
  )
);
```

- **Nombrado de archivo:** `stores/<dominio>.store.ts`.
- **Nombre del hook:** `use<Dominio>Store` (ej. `useAuthStore`).
- **Middleware `devtools`:** siempre activo. El `name` debe coincidir con el nombre del archivo.
- **Middleware `persist`:** solo si el estado debe sobrevivir refrescos de página.
- **Slices:** usar `StateCreator` cuando el store supere ~150 líneas.
- **Fetch desde el store:** NO hacer `fetch` directo. Si una acción necesita datos remotos, delegar a TanStack Query (ej. `refresh()` en `auth.store.ts` llama a `queryClient.invalidateQueries({ queryKey: ["me"] })`).

---

## 3. TanStack Query — Queries y Mutations

### 3.1 QueryClient

Configuración central en `src/lib/query-client.ts`:

```ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 2,
      staleTime: 30_000, // 30s — evita re-fetch en navegación entre tabs
    },
    mutations: {},
  },
});
```

### 3.2 Queries — `src/hooks/queries/`

| Hook | Archivo | QueryKey | Endpoint |
| --- | --- | --- | --- |
| `useMe()` | `use-me.ts` | `["me"]` | `GET /api/me` |
| `useProducts()` | `use-products.ts` | `["products"]` | `GET /api/products` |
| `useCategories()` | `use-categories.ts` | `["categories"]` | `GET /api/categories` |
| `useSales()` | `use-sales.ts` | `["sales"]` | `GET /api/sales` |
| `useMyTenant()` | `use-tenants.ts` | `["my-tenant"]` | `GET /api/tenants/me` |
| `useTenants()` | `use-tenants.ts` | `["tenants"]` | `GET /api/tenants` |
| `useSessions()` | `use-sessions.ts` | `["sessions"]` | `GET /api/me/sessions` |

**Convención de nombrado:** `use-<recurso>.ts`, exporta un hook `use<Recurso>()`.

**QueryKeys:** arrays planos con nombre de recurso como primer elemento. Si un recurso tiene variantes (por ID, filtros), se agregan elementos adicionales (ej. `["products", productId]`).

**Ejemplo canónico:**

```ts
// src/hooks/queries/use-products.ts
import { useQuery } from "@tanstack/react-query";
import { listProducts } from "@/lib/products";

export function useProducts() {
  return useQuery({
    queryFn: listProducts,
    queryKey: ["products"] as const,
  });
}
```

### 3.3 Mutations — `src/hooks/mutations/`

| Hook | Archivo | mutationFn | Invalida queryKeys |
| --- | --- | --- | --- |
| `useCreateProduct()` | `use-create-product.ts` | `createProduct` | `["products"]` |
| `useDeleteProduct()` | `use-delete-product.ts` | `deleteProduct` | `["products"]` |
| `useCreateCategory()` | `use-create-category.ts` | `createCategory` | `["categories"]` |
| `useUpdateCategory()` | `use-update-category.ts` | `updateCategory` | `["categories"]` |
| `useDeleteCategory()` | `use-delete-category.ts` | `deleteCategory` | `["categories"]` |
| `useRestoreCategory()` | `use-restore-category.ts` | `restoreCategory` | `["categories"]` |
| `useCreateSale()` | `use-create-sale.ts` | `createSale` | `["products"]` + `["sales"]` |
| `useCreateTenant()` | `use-create-tenant.ts` | `createTenant` | `["my-tenant"]` + `["tenants"]` |

**Convención de nombrado:** `use-<accion>-<recurso>.ts`, exporta `use<Accion><Recurso>()`.

**Toda mutación que modifica datos del servidor debe invalidar los queryKeys afectados en `onSuccess`.**

**Ejemplo canónico:**

```ts
// src/hooks/mutations/use-create-sale.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSale } from "@/lib/sales";

export function useCreateSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSale,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] }); // descuenta stock
      queryClient.invalidateQueries({ queryKey: ["sales"] }); // nueva venta en lista
    },
  });
}
```

**Nota:** `useCreateSale` es el único caso donde una mutación invalida **dos** recursos distintos (una venta afecta el catálogo de productos porque descuenta stock y la lista de ventas porque agrega un registro).

### 3.4 Patrón de invalidación

```
┌─────────────────┐    mutate()    ┌──────────────┐
│   Componente     │ ────────────→ │  useMutation  │
│  (dialog/ drawer) │               │  onSuccess:   │
└─────────────────┘               │   invalidate  │
                                   │   ↓  ↓  ↓    │
                                   └───┬──┬──┬────┘
                                       │  │  │
                              ┌────────┘  │  └────────┐
                              ▼           ▼           ▼
                         ['products'] ['sales']  ['categories']
                              │           │           │
                              ▼           ▼           ▼
                      useProducts()  useSales()  useCategories()
                      re-fetch       re-fetch    re-fetch
```

### 3.5 Hidratación de sesión

La hidratación inicial de `GET /api/me` sigue un patrón de **doble vía**:

1. `useMe()` (React Query) — ejecuta el fetch, maneja cache y re-fetch.
2. `SyncAuth` (`src/components/auth/sync-auth.tsx`) — componente que escucha el resultado de `useMe()` y sincroniza los datos al store de Zustand (`useAuthStore.setUser`, `.setStatus`).
3. `useAuth()` — hook público que lee del store de Zustand (sin depender de React Query).

Esto permite que los componentes usen `useAuth()` sin conocer React Query, y que React Query maneje la cache y revalidación de `/api/me`.

---

## 4. Context de UI local — ¿Por qué NO Zustand?

Los siguientes Contexts **siguen siendo React Context a propósito**:

| Context | Archivo | Scope |
| --- | --- | --- |
| `SidebarContext` | `ui/sidebar.tsx:44` | Estado abierto/cerrado del sidebar |
| `ChartContext` | `evilcharts/ui/chart.tsx:50` | Tema/colores del chart |
| `PieChartContext` | `evilcharts/charts/pie-chart.tsx:68` | Datos e interacción del pie |
| `PieShapeContext` | `evilcharts/charts/pie-chart.tsx:313` | Estado por segmento del pie |
| `HighlightedIndexContext` | `evilcharts/blocks/hover-trace-bar-chart.tsx:85` | Barra hovereada |
| `TooltipProvider` (Radix) | `ui/tooltip.tsx` | Delay de tooltip |

**Razones para mantenerlos como Context:**

1. **Scope restringido.** Ninguno de estos estados se comparte entre páginas o rutas distintas. Viven dentro de un subárbol de componentes y mueren con él.
2. **Sin beneficio de Zustand.** Zustand brilla cuando el estado es global y consumido por componentes lejanos en el árbol. Migrar estos Contexts a Zustand no reduce re-renders (ya están colocalizados) y añade indirección innecesaria.
3. **Acoplamiento con librerías.** `ChartContext`, `PieChartContext` y `PieShapeContext` son parte de la API interna de `recharts` wrappeada en `evilcharts`. Migrarlos rompería el contrato de esa capa.
4. **TooltipProvider** es de Radix UI — no es código propio.

---

## 5. Capa de API — `src/lib/`

Los archivos en `src/lib/` contienen **solo funciones puras de llamada HTTP** usando el cliente Axios compartido (`src/lib/api.ts`). No tienen estado, no usan hooks.

| Archivo | Funciones |
| --- | --- |
| `api.ts` | `request<T>()`, `ApiClientError`, `isUnauthenticatedError` |
| `auth.ts` | `getMe`, `checkHealth`, `getAuthorizationUrl`, `logoutSession`, `getActiveSessions`, `revokeSession`, `getMyTenant`, `listTenants`, `switchTenant`, `createTenant` |
| `products.ts` | `listProducts`, `createProduct`, `updateProduct`, `deleteProduct` |
| `categories.ts` | `listCategories`, `createCategory`, `updateCategory`, `deleteCategory`, `restoreCategory` |
| `sales.ts` | `listSales`, `createSale` |

Estas funciones son el `queryFn` / `mutationFn` de los hooks de TanStack Query.

---

## 6. Referencia histórica

La migración desde React Context + event bus (`window.dispatchEvent`) a Zustand + TanStack Query está documentada en [`docs/migration-zustand-query.md`](../../docs/migration-zustand-query.md).

Resumen de lo eliminado:

- `src/contexts/auth.context.tsx` — reemplazado por `auth.store.ts` + `use-me.ts` + `sync-auth.tsx`.
- 3 constantes de event bus (`PRODUCTS_CHANGED_EVENT`, `CATEGORIES_CHANGED_EVENT`, `SALES_CHANGED_EVENT`) — reemplazadas por `queryClient.invalidateQueries`.
- 9 patrones `useState`+`useEffect` manuales para fetch — reemplazados por `useQuery`/`useMutation`.
