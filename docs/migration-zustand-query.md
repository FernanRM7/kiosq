# Auditoría de estado global y fetching para migración a Zustand/Query

> **Fecha:** 2026-07-08  
> **Repositorio:** kiosq — monorepo npm workspaces con `apps/front` (React 19 + Vite) y `apps/back` (NestJS)  
> **Objetivo:** identificar todos los puntos de estado global y fetching manual para migrarlos a Zustand (estado cliente) y TanStack Query (datos remotos).

---

## 1. Context Providers

### 1.1 Providers globales (scope: app completa)

| #   | Archivo                            | Context / Provider             | Estado que maneja                                                                                                                                                                                                                        | Componentes consumidores                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/contexts/auth.context.tsx:62` | `AuthContext` / `AuthProvider` | `status` (`"loading" \| "authenticated" \| "unauthenticated"`), `user` (`MeUser \| null`), `pendingAction` (`"login" \| "register" \| "logout" \| null`), `error` (`string \| null`) + acciones `login`, `register`, `logout`, `refresh` | `ProtectedRoute` (`components/auth/protected-route.tsx`), `LoginForm` (`components/auth/login-form.tsx`), `RegisterForm` (`components/auth/register-form.tsx`), `UserNav` (`components/dashboard/user-nav.tsx`), `WorkspaceSwitcher` (`components/dashboard/workspace-switcher.tsx`), `OnboardingPage` (`pages/onboarding.tsx`) |

### 1.2 Providers locales (scope: subtree de componentes, no ameritan Zustand)

| #   | Archivo                                                  | Context                               | Estado                            | Consumidores                         |
| --- | -------------------------------------------------------- | ------------------------------------- | --------------------------------- | ------------------------------------ |
| 2   | `components/ui/sidebar.tsx`                              | `SidebarContext`                      | `open`/`closed`, `mobile`         | `SidebarTrigger`, `DashboardSidebar` |
| 3   | `components/evilcharts/ui/chart.tsx`                     | `ChartContext`                        | Tema/colores de chart             | Componentes de gráficos              |
| 4   | `components/evilcharts/charts/pie-chart.tsx`             | `PieChartContext` + `PieShapeContext` | Datos e interacción del pie chart | Subcomponentes del pie               |
| 5   | `components/evilcharts/blocks/hover-trace-bar-chart.tsx` | `HighlightedIndexContext`             | Índice de barra hovereada         | Subcomponentes del bar chart         |
| 6   | `components/ui/tooltip.tsx`                              | `TooltipProvider` (Radix)             | Delay de tooltip                  | Componentes con tooltip              |

**Nota:** los providers locales #2–#6 son estado de UI puramente visual y de scope restringido. No se recomienda migrarlos a Zustand porque no ganan nada (ya son locales, no se comparten entre páginas).

---

## 2. Event Bus (`window.dispatchEvent` / `window.addEventListener`)

El proyecto usa 3 constantes de evento como mecanismo de invalidación de caché manual entre componentes distantes en la jerarquía React.

### 2.1 Evento `products:changed`

| Rol             | Archivo                                       | Línea | Detalle                                                                          |
| --------------- | --------------------------------------------- | ----- | -------------------------------------------------------------------------------- |
| **Declaración** | `src/lib/products.ts`                         | 3     | `export const PRODUCTS_CHANGED_EVENT = "products:changed"`                       |
| **Emisor**      | `src/components/dashboard/product-dialog.tsx` | 48    | `window.dispatchEvent(new Event(PRODUCTS_CHANGED_EVENT))` — al crear un producto |
| **Oyente**      | `src/pages/products.tsx`                      | 44    | `window.addEventListener(PRODUCTS_CHANGED_EVENT, ...)` — re-fetch de lista       |

### 2.2 Evento `categories:changed`

| Rol             | Archivo                                             | Línea | Detalle                                                                                              |
| --------------- | --------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------- |
| **Declaración** | `src/lib/categories.ts`                             | 3     | `export const CATEGORIES_CHANGED_EVENT = "categories:changed"`                                       |
| **Emisor**      | `src/components/dialogs/create-category-dialog.tsx` | 61    | `window.dispatchEvent(new CustomEvent(CATEGORIES_CHANGED_EVENT))` — al crear                         |
| **Emisor**      | `src/components/dialogs/edit-category-dialog.tsx`   | 71    | `window.dispatchEvent(new CustomEvent(CATEGORIES_CHANGED_EVENT))` — al editar                        |
| **Emisor**      | `src/components/dialogs/delete-category-dialog.tsx` | 44    | `window.dispatchEvent(new CustomEvent(CATEGORIES_CHANGED_EVENT))` — al eliminar                      |
| **Emisor**      | `src/pages/categories.tsx`                          | 93    | `window.dispatchEvent(new CustomEvent(CATEGORIES_CHANGED_EVENT))` — al restaurar                     |
| **Oyente**      | `src/pages/categories.tsx`                          | 61    | `window.addEventListener(CATEGORIES_CHANGED_EVENT, ...)` — re-fetch de lista                         |
| **Oyente**      | `src/components/dialogs/product-form-fields.tsx`    | 46    | `window.addEventListener(CATEGORIES_CHANGED_EVENT, ...)` — re-fetch de categorías para el `<select>` |

### 2.3 Evento `sales:changed`

| Rol             | Archivo                                     | Línea | Detalle                                                                     |
| --------------- | ------------------------------------------- | ----- | --------------------------------------------------------------------------- |
| **Declaración** | `src/lib/sales.ts`                          | 3     | `export const SALES_CHANGED_EVENT = "sales:changed"`                        |
| **Emisor**      | `src/components/dashboard/sales-drawer.tsx` | 152   | `window.dispatchEvent(new Event(SALES_CHANGED_EVENT))` — al completar venta |
| **Oyente**      | `src/pages/sales.tsx`                       | 43    | `window.addEventListener(SALES_CHANGED_EVENT, ...)` — re-fetch de lista     |

### 2.4 Listeners no relacionados al event bus (infraestructura)

| Archivo                         | Línea | Evento                                               | Propósito                                |
| ------------------------------- | ----- | ---------------------------------------------------- | ---------------------------------------- |
| `src/main.tsx`                  | 8     | `window.addEventListener("error", ...)`              | Log global de errores JS no capturados   |
| `src/main.tsx`                  | 18    | `window.addEventListener("unhandledrejection", ...)` | Log de promesas rechazadas               |
| `src/components/ui/sidebar.tsx` | 100   | `window.addEventListener("keydown", ...)`            | Atajo de teclado para toggle del sidebar |

Estos últimos **no son parte del event bus de dominio** y no requieren migración.

---

## 3. Fetch/useEffect manuales para datos remotos

Cada uno de estos patrones replica a mano lo que TanStack Query provee (loading, error, cache, revalidación, refetch on window focus, etc.).

| #   | Archivo                                                 | Endpoint                                   |      Loading state      |    Error state     | Cache / Revalidación                          | Notas                                                            |
| --- | ------------------------------------------------------- | ------------------------------------------ | :---------------------: | :----------------: | --------------------------------------------- | ---------------------------------------------------------------- |
| 1   | `src/contexts/auth.context.tsx:86-109`                  | `GET /api/me`                              |   `status="loading"`    |  `error` (string)  | Ninguno. Solo on mount.                       | Hidratación de sesión. `useEffect` en línea 169.                 |
| 2   | `src/pages/products.tsx:17-33`                          | `GET /api/products`                        |   `loading` (boolean)   |  `error` (string)  | Re-fetch vía listener de `products:changed`   | Lista de productos del tenant.                                   |
| 3   | `src/pages/categories.tsx:34-49`                        | `GET /api/categories`                      |   `loading` (boolean)   |  `error` (string)  | Re-fetch vía listener de `categories:changed` | Lista de categorías (activas + eliminadas).                      |
| 4   | `src/pages/sales.tsx:16-32`                             | `GET /api/sales`                           |   `loading` (boolean)   |  `error` (string)  | Re-fetch vía listener de `sales:changed`      | Grid de ventas recientes.                                        |
| 5   | `src/pages/settings.tsx:64-73`                          | `GET /api/me/sessions`                     |   `loading` (boolean)   | Solo console.error | Ninguno                                       | Sesiones activas del usuario.                                    |
| 6   | `src/pages/onboarding.tsx:18-33`                        | `GET /api/tenants/me`                      |  `checking` (boolean)   | Solo console.error | Ninguno                                       | Verifica si el usuario ya tiene tenant.                          |
| 7   | `src/components/dashboard/workspace-switcher.tsx:26-43` | `GET /api/tenants/me` + `GET /api/tenants` | No tiene (sin feedback) | Solo console.error | Ninguno                                       | Tenant activo + lista de tenants.                                |
| 8   | `src/components/dashboard/sales-drawer.tsx:45-58`       | `GET /api/products`                        | No tiene (sin feedback) | Solo console.error | Refetch al abrir drawer (línea 54-58)         | Catálogo de productos para armar venta.                          |
| 9   | `src/components/dialogs/product-form-fields.tsx:30-54`  | `GET /api/categories` (solo activas)       | No tiene (sin feedback) | Solo console.error | Re-fetch vía listener de `categories:changed` | Opciones del `<select>` de categoría en formularios de producto. |

---

## 4. Priorización

Cada ítem se evalúa en tres dimensiones (escala 1–5, donde 5 = máxima):

| #                     | Ítem                                                | Frecuencia de uso | Riesgo de regresión | Acoplamiento | **Score** |
| --------------------- | --------------------------------------------------- | :---------------: | :-----------------: | :----------: | :-------: |
| **Context Providers** |
| C1                    | `AuthProvider` (auth.context)                       |         5         |          5          |      5       |  **15**   |
| C2                    | `SidebarContext` (UI local)                         |         3         |          1          |      1       |     5     |
| **Event Bus**         |
| E1                    | `categories:changed` (5 emisores, 2 oyentes)        |         4         |          4          |      4       |  **12**   |
| E2                    | `products:changed` (1 emisor, 1 oyente)             |         3         |          3          |      3       |   **9**   |
| E3                    | `sales:changed` (1 emisor, 1 oyente)                |         2         |          2          |      2       |   **6**   |
| **Fetch manual**      |
| F1                    | `GET /api/me` (auth.context)                        |         5         |          5          |      4       |  **14**   |
| F2                    | `GET /api/products` — ProductsPage                  |         3         |          3          |      3       |   **9**   |
| F3                    | `GET /api/categories` — CategoriesPage              |         3         |          3          |      3       |   **9**   |
| F4                    | `GET /api/categories` — ProductFormFields           |         2         |          2          |      3       |     7     |
| F5                    | `GET /api/sales` — SalesPage                        |         2         |          2          |      2       |   **6**   |
| F6                    | `GET /api/products` — SalesDrawer                   |         2         |          2          |      2       |   **6**   |
| F7                    | `GET /api/tenants/me` + tenants — WorkspaceSwitcher |         2         |          3          |      3       |     8     |
| F8                    | `GET /api/me/sessions` — SettingsPage               |         1         |          1          |      1       |     3     |
| F9                    | `GET /api/tenants/me` — OnboardingPage              |         1         |          2          |      1       |     4     |

### Interpretación del score

- **Score ≥ 12:** migrar con alta prioridad. Son puntos de falla frecuentes, con alto acoplamiento y riesgo de regresión si se tocan.
- **Score 8–11:** migrar en segunda fase. Mejoran la mantenibilidad pero no son críticos.
- **Score ≤ 7:** migrar al final o no migrar. Bajo impacto.

---

## 5. Orden de migración incremental propuesto

### Fase 1 — Auth Store (Zustand) + `/api/me` (React Query)

**Qué migrar:**

1. Crear `stores/auth.store.ts` con Zustand reemplazando `AuthContext`:
   - Estado: `status`, `user`, `pendingAction`, `error`.
   - Acciones: `login()`, `register()`, `logout()`, `hydrate()` (usa React Query internamente).
2. Crear `hooks/queries/use-me.ts` con `useQuery` para `GET /api/me`.
3. Refactorizar `hydrate()` en el store para que delegue el fetch a la query.

**Archivos impactados:**

- `contexts/auth.context.tsx` → se elimina o se vuelve wrapper del store.
- `hooks/use-auth.ts` → lee del store de Zustand en vez del context.
- `components/auth/protected-route.tsx` → usa `useAuth()` (sin cambios en interfaz).
- `components/auth/login-form.tsx` → sin cambios en interfaz.
- `components/auth/register-form.tsx` → sin cambios en interfaz.
- `components/dashboard/user-nav.tsx` → sin cambios en interfaz.
- `components/dashboard/workspace-switcher.tsx` → sin cambios en interfaz.
- `pages/onboarding.tsx` → sin cambios en interfaz.

**Justificación:** El `AuthProvider` es la columna vertebral de la app (score 15). Es el provider más acoplado (6 consumidores directos) y su migración a Zustand elimina el riesgo de re-renders innecesarios en toda la app. Además, migrar `GET /api/me` a React Query en esta misma fase resuelve la hidratación de sesión sin necesidad de un `useEffect` manual. **No se rompe ninguna interfaz pública** porque `useAuth()` mantiene el mismo contrato.

---

### Fase 2 — Queries de dominio: Products + Categories

**Qué migrar:**

1. Crear `hooks/queries/use-products.ts` con `useQuery` para `GET /api/products`.
   - Reemplaza el `useEffect` + `useState` de `ProductsPage`.
   - `staleTime` configurable (ej. 30s) para evitar re-fetch innecesario al navegar entre tabs.
2. Crear `hooks/queries/use-categories.ts` con `useQuery` para `GET /api/categories`.
   - Idem para `CategoriesPage` y `ProductFormFields`.
3. Migrar invalidación con `queryClient.invalidateQueries` reemplazando `window.dispatchEvent`:
   - `product-dialog.tsx` → llama `queryClient.invalidateQueries({ queryKey: ['products'] })`.
   - `create-category-dialog.tsx`, `edit-category-dialog.tsx`, `delete-category-dialog.tsx` → invalidan `['categories']`.
   - `sales-drawer.tsx` → invalida `['sales']`.
4. Eliminar las constantes `PRODUCTS_CHANGED_EVENT`, `CATEGORIES_CHANGED_EVENT`, `SALES_CHANGED_EVENT` y todos los `window.addEventListener`/`dispatchEvent` asociados.

**Archivos impactados:**

- `pages/products.tsx` → usa `useProducts()` en vez de useState+useEffect+event listener.
- `pages/categories.tsx` → usa `useCategories()` + `useMutation` para restore.
- `pages/sales.tsx` → usa `useSales()` en vez de useState+useEffect+event listener.
- `components/dashboard/product-dialog.tsx` → `useMutation` + invalida query.
- `components/dashboard/sales-drawer.tsx` → `useMutation` + invalida queries de products y sales.
- `components/dialogs/product-form-fields.tsx` → usa `useCategories()`.
- `components/dialogs/create-category-dialog.tsx` → `useMutation` + invalida query.
- `components/dialogs/edit-category-dialog.tsx` → `useMutation` + invalida query.
- `components/dialogs/delete-category-dialog.tsx` → `useMutation` + invalida query.
- `components/dialogs/delete-product-dialog.tsx` → `useMutation` + invalida query (si se desea refrescar).
- `lib/products.ts`, `lib/categories.ts`, `lib/sales.ts` → se eliminan las constantes `*_CHANGED_EVENT`.

**Justificación:** Este bloque (score combinado 27) elimina por completo el patrón de event bus improvisado con `window.dispatchEvent`. Al mover toda la lógica de fetch a React Query + invalidación, se gana:

- Caché automática (no se re-fetcha al montar/desmontar si los datos son frescos).
- Revalidación en background (stale-while-revalidate).
- Deduplicación de requests (si `ProductsPage` y `SalesDrawer` se montan al mismo tiempo, solo se hace un `GET /api/products`).
- Las mutaciones (`useMutation`) manejan loading/error de forma estándar.

---

### Fase 3 — Queries secundarias (tenants, sessions, onboarding)

**Qué migrar:**

1. `hooks/queries/use-tenants.ts` para `GET /api/tenants/me` y `GET /api/tenants` (usa `WorkspaceSwitcher` y `OnboardingPage`).
2. `hooks/queries/use-sessions.ts` para `GET /api/me/sessions` (`SettingsPage`).
3. `hooks/mutations/use-create-tenant.ts` para `POST /api/tenants` (`OnboardingDialog`).

**Archivos impactados:**

- `components/dashboard/workspace-switcher.tsx` → usa `useMyTenant()` + `useTenants()`.
- `pages/settings.tsx` → usa `useSessions()`.
- `pages/onboarding.tsx` → usa `useMyTenant()`.
- `components/onboarding/onboarding-dialog.tsx` → usa `useMutation` para `createTenant`.

**Justificación:** Score bajo (suma 15), baja frecuencia de uso. No hay urgencia pero completa la migración. En este punto **todo el fetching manual y event bus queda eliminado** del proyecto.

---

### Fase 4 (opcional) — Limpieza final

- Eliminar `contexts/auth.context.tsx` si ya fue completamente reemplazado.
- Eliminar las constantes `*_CHANGED_EVENT` de `lib/products.ts`, `lib/categories.ts`, `lib/sales.ts`.
- Los providers locales (#2–#6 de la sección 1.2) se mantienen como Context (no justifica migrarlos a Zustand).

---

## Resumen visual de la migración

```
Antes                                     Después
──────────────────────────────────────    ──────────────────────────────────────
AuthContext (React Context)               authStore (Zustand)
  + useEffect → GET /api/me                + useQuery(['me'], getMe)

ProductsPage                               ProductsPage
  useState + useEffect + event listener      useQuery(['products'], listProducts)
  → GET /api/products

CategoriesPage                             CategoriesPage
  useState + useEffect + event listener      useQuery(['categories'], listCategories)

SalesPage                                  SalesPage
  useState + useEffect + event listener      useQuery(['sales'], listSales)

ProductDialog                              ProductDialog
  dispatchEvent('products:changed')          useMutation + invalidateQueries(['products'])

CreateCategoryDialog                       CreateCategoryDialog
  dispatchEvent('categories:changed')        useMutation + invalidateQueries(['categories'])

SettingsPage                               SettingsPage
  useState + useEffect → GET /api/me/...    useQuery(['sessions'], getSessions)

WorkspaceSwitcher                          WorkspaceSwitcher
  useState + useEffect → GET tenants         useQuery(['my-tenant'], getMyTenant)
                                            useQuery(['tenants'], listTenants)

window.addEventListener(...)               ❌ eliminado (reemplazado por invalidateQueries)
window.dispatchEvent(...)                  ❌ eliminado
```

---

## Dependencias necesarias

Se requiere agregar al `package.json` de `apps/front`:

```
zustand          — ^5.x (store global)
@tanstack/react-query  — ^5.x (fetching, cache, mutaciones)
```

---

## Verificación posterior a cada fase

| Fase | Qué validar                                                                                                                                                                                    |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Login, logout, registro, ProtectedRoute redirige correctamente, UserNav muestra nombre/email, `useAuth()` devuelve mismo contrato.                                                             |
| 2    | Listado de productos/categorías/ventas carga y se actualiza tras crear/editar/eliminar. El select de categoría en el formulario de producto se refresca. No quedan `dispatchEvent` de dominio. |
| 3    | Workspace switcher lista tenants y permite cambiar. Settings muestra sesiones. Onboarding crea tenant y redirige.                                                                              |
| 4    | `grep -r "dispatchEvent\|addEventListener" src/` solo muestra main.tsx y sidebar.tsx (infraestructura).                                                                                        |

---

## Estado post-migración (2026-07-08)

### Migrado a Zustand

| Store       | Archivo                    | Middleware               | Reemplaza a                                                    |
| ----------- | -------------------------- | ------------------------ | -------------------------------------------------------------- |
| `authStore` | `src/stores/auth.store.ts` | `devtools("auth-store")` | `AuthContext` (`src/contexts/auth.context.tsx`, **eliminado**) |

### Migrado a TanStack Query

| Recurso            | Query hook                                      | QueryKey         | Mutaciones                                                                          | Reemplaza fetch manual en                                                |
| ------------------ | ----------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `/api/me`          | `useMe()` (`queries/use-me.ts`)                 | `["me"]`         | —                                                                                   | `AuthProvider.hydrate()`                                                 |
| `/api/products`    | `useProducts()` (`queries/use-products.ts`)     | `["products"]`   | `useCreateProduct`, `useDeleteProduct`                                              | `ProductsPage`, `SalesDrawer`, `ProductFormFields` (vía `useCategories`) |
| `/api/categories`  | `useCategories()` (`queries/use-categories.ts`) | `["categories"]` | `useCreateCategory`, `useUpdateCategory`, `useDeleteCategory`, `useRestoreCategory` | `CategoriesPage`, `ProductFormFields`                                    |
| `/api/sales`       | `useSales()` (`queries/use-sales.ts`)           | `["sales"]`      | `useCreateSale` (invalida `["products"]` + `["sales"]`)                             | `SalesPage`, `SalesDrawer`                                               |
| `/api/tenants/me`  | `useMyTenant()` (`queries/use-tenants.ts`)      | `["my-tenant"]`  | `useCreateTenant` (invalida `["my-tenant"]` + `["tenants"]`)                        | `WorkspaceSwitcher`, `OnboardingPage`                                    |
| `/api/tenants`     | `useTenants()` (`queries/use-tenants.ts`)       | `["tenants"]`    | —                                                                                   | `WorkspaceSwitcher`                                                      |
| `/api/me/sessions` | `useSessions()` (`queries/use-sessions.ts`)     | `["sessions"]`   | — (revoke usa `queryClient.invalidateQueries`)                                      | `SettingsPage`                                                           |

### Event bus eliminado

| Constante                  | Archivo original          | Estado                            |
| -------------------------- | ------------------------- | --------------------------------- |
| `PRODUCTS_CHANGED_EVENT`   | `src/lib/products.ts:3`   | Eliminada (3 emisores, 1 oyente)  |
| `CATEGORIES_CHANGED_EVENT` | `src/lib/categories.ts:3` | Eliminada (5 emisores, 2 oyentes) |
| `SALES_CHANGED_EVENT`      | `src/lib/sales.ts:3`      | Eliminada (1 emisor, 1 oyente)    |

### Verificación final

```
$ grep -rn "dispatchEvent\|addEventListener" apps/front/src
apps/front/src/components/ui/sidebar.tsx:100    window.addEventListener("keydown", ...)   ← atajo de teclado (infra)
apps/front/src/hooks/use-mobile.ts:9            mql.addEventListener("change", ...)      ← MediaQueryList (infra)
apps/front/src/main.tsx:16,26                   window.addEventListener("error"/"unhandledrejection", ...)  ← global error logging (infra)
apps/front/src/hooks/mutations/README.md:46                                               ← documentación
```

Cero `dispatchEvent` de dominio. Cero `addEventListener` de event bus.

### Contexts locales preservados (React Context, NO Zustand)

| Context                   | Archivo                                                         | Scope                           |
| ------------------------- | --------------------------------------------------------------- | ------------------------------- |
| `SidebarContext`          | `src/components/ui/sidebar.tsx:44`                              | Sidebar abierto/cerrado, mobile |
| `ChartContext`            | `src/components/evilcharts/ui/chart.tsx:50`                     | Tema/colores de chart           |
| `PieChartContext`         | `src/components/evilcharts/charts/pie-chart.tsx:68`             | Datos de pie chart              |
| `PieShapeContext`         | `src/components/evilcharts/charts/pie-chart.tsx:313`            | Estado por segmento             |
| `HighlightedIndexContext` | `src/components/evilcharts/blocks/hover-trace-bar-chart.tsx:85` | Índice hovereado                |

### Archivos eliminados

- `src/contexts/auth.context.tsx` (204 líneas) — reemplazado por `auth.store.ts` + `use-me.ts` + `sync-auth.tsx`
- `src/contexts/` — directorio vacío (eliminado automáticamente al borrar el único archivo)

### Conteo final

| Métrica                              | Antes | Después                 |
| ------------------------------------ | ----- | ----------------------- |
| `useState` + `useEffect` para fetch  | 9     | 0                       |
| `window.dispatchEvent` de dominio    | 7     | 0                       |
| `window.addEventListener` de dominio | 3     | 0                       |
| Hooks de React Query creados         | 0     | 6 queries + 8 mutations |
| Stores de Zustand creados            | 0     | 1                       |
| Archivos modificados                 | —     | 17                      |
| Archivos nuevos                      | —     | 15                      |
| Archivos eliminados                  | —     | 1                       |
