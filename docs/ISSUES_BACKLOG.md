# Issues Backlog — Kiosq

> Listado de fixes y features pendientes para el MVP. Cada item incluye contexto técnico para facilitar la redacción final del issue en GitHub.

---

## Fixes

### 1. Barra lateral poco intuitiva (solo iconos)

El menú lateral colapsado por defecto muestra únicamente iconos, dificultando la identificación de cada módulo. Mantener expandido por defecto o hacer el toggle más visible.

### 2. Visualización del historial de ventas y validaciones de formularios

Áreas de mejora en la UI de listado/detalle de ventas y en las validaciones de formularios del POS.

### 3. Redirect URI en WorkOS

La URI configurada en el Dashboard de WorkOS no coincide con la que usa el backend (`/auth/callback`). Actualizar desde el panel de WorkOS.

### ~~4. Offline first — Resolución de conflictos + idempotencia~~ ✅ Resuelto (HEL-50)

Falta resolver conflictos con regla server-wins para stock y deduplicación por `offlineId`. El backend silencia errores y no persiste `SyncEvent`, no hay estados `CONFLICT`/`REJECTED`. Resuelto en `fix/offline-engine-hel49-54`: `OfflineSyncService` persiste `SyncEvent` con status `APPLIED`, `CONFLICT` (stock insuficiente, server-wins) o `REJECTED` (evento inválido). La idempotencia por `offlineId` funciona con test explícito.

### ~~5. Offline first — Bug: total de venta offline siempre $0.00~~ ✅ Resuelto (HEL-54)

`lib/sales.ts` (frontend) hardcodea `price: 0` por cada línea porque no resuelve precios del catálogo local en Dexie. El total calcula $0.00. Resuelto en `fix/offline-engine-hel49-54`: `createLocalSale` resuelve precios y taxRate desde `products` table en Dexie y calcula subtotal/taxAmount/total correctamente.

### ~~6. Offline first — Tabla Dexie `products` nunca se pobla~~ ✅ Resuelto (HEL-49)

La tabla existe en el schema local pero ningún código escribe en ella. Sin internet no hay catálogo de productos para vender. Resuelto en `fix/offline-engine-hel49-54`: `listProducts()` escribe en Dexie cuando la request tiene éxito; en modo offline fallback a `getLocalProducts()` desde Dexie.

### ~~7. Offline first — Sin retry/backoff real~~ ✅ Resuelto (HEL-55)

`syncNow()` solo reintenta en el próximo evento `online`. No hay exponential backoff con jitter como contempla el plan. Resuelto en `fix/offline-engine-hel49-54`: `SyncProvider` incluye clasificación de errores (retryable no-reintentar vs permanentes REJECTED/CONFLICT) y exponential backoff con jitter (±20%, 2s→5min cap, max 8 intentos).

### ~~8. Offline first — Brecha de seguridad en SyncController~~ ✅ Resuelto (HEL-69)

El backend `SyncController` opera sobre `tenantId`/`userId`/`branchId` del body crudo sin verificar autorización del tenant/device contra la sesión autenticada. Resuelto en `fix/resolver-review-de-offline-first`: ahora deriva estos valores exclusivamente de la sesión autenticada vía `@CurrentUser`.

### 9. `TenantController.create` sin validación Zod

Toma `@Body("name")` crudo, inconsistente con el resto del sistema que usa ZodValidationPipe.

---

## Features

### 10. Implementar Zustand y TanStack Query

El estado global usa Context + `window.dispatchEvent` como event bus, y el fetching es manual en `useEffect`. Migrar a Zustand y TanStack Query para cache, revalidación y estado escalable.

### 11. Separación de vistas por rol (dependiente, dueño, admin)

Hoy el `role` viene de WorkOS pero no se usa para diferenciar vistas. Implementar separación de UI y permisos por rol sin necesidad del modelo RBAC/ABAC formal.

### 12. Refunds / voids de ventas

Las ventas son read-only. No hay endpoint ni UI para devoluciones (`CANCELLED`/`REFUNDED`/`PARTIAL`).

### 13. Proveedores — UI y lógica

La página `/dashboard/suppliers` es 100% mock (datos hardcodeados). Implementar CRUD real con backend + endpoints.

### 14. Reportes básicos + dashboard con datos reales

El dashboard muestra datos mock. Crear endpoint `GET /reports/sales` agregado por período y conectar el dashboard a datos reales.

### 15. Selector de método de pago y descuentos en venta

El drawer del POS hardcodea `paymentMethod: "CASH"` y no permite aplicar `discountAmount`. Agregar selector de método (`CASH`/`CARD`/`TRANSFER`/`QR`/`CREDIT`) y campo de descuento.

### 16. Offline tokens firmados (dispositivos)

`verifyWorkosToken` con JWKS existe en `utils/jwt.util.ts` pero ningún guard la usa. El modelo `Device.offlineTokenHash` está definido pero no hay generación ni validación de tokens offline. Prioritario para modo offline real.

### 17. Impresión de ticket / receipt

Generación del comprobante HTML/PDF para ticket de venta en web. (WebUSB/ESC-POS puede ser post-MVP.)
