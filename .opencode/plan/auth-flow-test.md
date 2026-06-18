# Auth Flow — Implementación y Lecciones Aprendidas

## Estado final del sistema

| Componente             | Puerto | Estado                                           |
| ---------------------- | ------ | ------------------------------------------------ |
| Backend NestJS         | 3000   | ✅ Auth, tenant, sesiones funcionando            |
| Frontend Vite          | 5173   | ✅ Login, onboarding, dashboard, sidebar         |
| Redis                  | 6379   | ✅ Sesiones activas guardadas (`session:*` keys) |
| DB Supabase PostgreSQL | —      | ✅ Seed ejecutado, tenants/usuarios creados      |
| Onboarding dialog      | —      | ✅ Crea tenant + usuario, redirect a dashboard   |
| Plan en DB             | —      | ✅ Seed "Starter" creado                         |
| Users/Tenants locales  | —      | ✅ 1 tenant activo ("My Test Workspace 2")       |

---

## Resumen de cambios

### Nuevos archivos

| Archivo                                              | Propósito                                     |
| ---------------------------------------------------- | --------------------------------------------- |
| `apps/back/prisma/seed.ts`                           | Seed del plan "Starter" en DB                 |
| `apps/back/src/services/tenant.service.ts`           | CRUD de tenants (create + getByUserId)        |
| `apps/back/src/controllers/tenant.controller.ts`     | Endpoints `POST /tenants` y `GET /tenants/me` |
| `apps/back/src/routes/tenant.routes.ts`              | Registro del TenantController en el módulo    |
| `apps/back/src/services/session-registry.service.ts` | Registro y tracking de sesiones en Redis      |
| `apps/front/src/pages/settings.tsx`                  | Página de settings con sesiones activas       |

### Archivos modificados

| Archivo                                                         | Cambio                                                                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `apps/back/package.json`                                        | Se añadió `prisma.seed` script                                                              |
| `apps/back/src/app.module.ts`                                   | Se registraron TenantService y TenantController                                             |
| `apps/back/src/common/filters/http-exception.filter.ts`         | Se añadió Logger para 500s no manejados                                                     |
| `apps/back/src/common/interceptors/api-response.interceptor.ts` | Envoltorio `{ success, data }` global                                                       |
| `apps/back/src/constants/cookie.constants.ts`                   | `sameSite: "none"`, `secure: true` para cross-origin                                        |
| `apps/back/src/controllers/auth.controller.ts`                  | Callback redirect a `/onboarding`, Redis session registry, try/catch en authenticateSession |
| `apps/back/src/controllers/user.controller.ts`                  | Endpoint `GET /me`, `GET /me/sessions`, `DELETE /me/sessions/:id`                           |
| `apps/back/src/services/auth.service.ts`                        | WorkOS constructor con `clientId`, appUrl expuesto                                          |
| `apps/back/src/services/session.service.ts`                     | authenticateSession con try/catch, sessionActive, revokeSession, clearSession               |
| `apps/front/src/App.tsx`                                        | Ruta `/onboarding` agregada                                                                 |
| `apps/front/src/components/auth/login-form.tsx`                 | Inputs disabled eliminados, solo botón WorkOS                                               |
| `apps/front/src/components/auth/register-form.tsx`              | Inputs disabled eliminados, solo botón WorkOS                                               |
| `apps/front/src/components/dashboard/workspace-switcher.tsx`    | Muestra nombre real del tenant desde API                                                    |
| `apps/front/src/components/dashboard/user-nav.tsx`              | Muestra nombre+email del usuario WorkOS                                                     |
| `apps/front/src/components/onboarding/onboarding-dialog.tsx`    | Implementado: crea tenant via API                                                           |
| `apps/front/src/contexts/auth.context.tsx`                      | AuthProvider con login/register/logout/refresh                                              |
| `apps/front/src/lib/auth.ts`                                    | Cliente HTTP con `authFetch`, `getMe`, `createTenant`, `getMyTenant`, etc.                  |
| `apps/front/src/pages/onboarding.tsx`                           | Auto-redirect a dashboard si ya tiene tenant                                                |
| `apps/front/vite.config.ts`                                     | Proxy `/auth`, `/me`, `/tenants`, etc. a backend                                            |

---

## Cómo levantar y probar

### Prerrequisitos

- Node.js + bun
- Redis corriendo en `localhost:6379`
- PostgreSQL (Supabase) con migrations aplicadas
- WorkOS dashboard con:
  - `http://localhost:3000/auth/callback` registrado como Redirect URI
  - `http://localhost:5173` registrado como origin (opcional)

### Variables de entorno (`apps/back/.env`)

```
WORKOS_API_KEY=sk_test_...
WORKOS_CLIENT_ID=client_...
WORKOS_COOKIE_PASSWORD=...
DATABASE_URL=postgresql://...supabase.co...
DIRECT_URL=postgresql://...supabase.co...
WORKOS_REDIRECT_URI=http://localhost:3000/auth/callback
APP_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
REDIS_HOST=localhost
REDIS_PORT=6379
WORKOS_WEBHOOK_SECRET=we_...
```

### Pasos

```bash
# 1. Seed DB
cd apps/back && bun prisma db seed

# 2. Iniciar backend (puerto 3000)
cd apps/back && bun run dev

# 3. Iniciar frontend (puerto 5173)
cd apps/front && bun run dev
```

### Probar flujo completo

1. Abrir `http://localhost:5173/login`
2. Click "Continue with WorkOS"
3. Autenticar en WorkOS AuthKit
4. Serás redirigido a `/onboarding`
5. Ingresar nombre del workspace y crear
6. Redirige a `/dashboard`
7. Verificar sidebar muestra nombre del workspace y usuario
8. Verificar sesiones en Redis: `redis-cli keys 'session:*'`

---

## Lecciones Aprendidas / Decisiones Técnicas

### Cross-origin cookies (Vite:5173 → Nest:3000)

- Dos puertos distintos requieren `SameSite=None; Secure` para que la cookie `wos-session` se envíe entre orígenes.
- Chrome acepta `Secure` cookies en `localhost` (excepción de Chrome para desarrollo local).
- `authFetch` usa `API_BASE_URL = "http://localhost:3000"` con `credentials: "include"`.

### WorkOS sealed session

- `WorkOS` constructor necesita `clientId` como segundo argumento `{ clientId }`.
- Sin `clientId`, `loadSealedSession()` y `registerSession()` lanzan "Missing client ID".
- `authenticateSession` envuelto en try/catch para devolver 401 con `reason` en vez de 500.

### Callback redirect

- El callback de WorkOS (`GET /auth/callback`) redirige a `/onboarding`, no a `/dashboard`.
- La página de onboarding verifica si el usuario ya tiene tenant via `GET /tenants/me`.
  - Si tiene tenant → redirect a `/dashboard`.
  - Si no → muestra el diálogo de creación.

### Creación de tenant

- `TenantService.createTenant` busca si el usuario existe en DB por `workosUserId`.
  - Si existe → actualiza su `role: "ADMIN"` y asigna `tenantId`.
  - Si no existe → crea el usuario con `name: "User"`, `role: "ADMIN"`.
- Esto evita el error "No record found for update" cuando el usuario es primerizo (no tiene registro en DB local).

### Redis sessions

- Sesiones registradas en Redis con estructura `session:<userId>:<sessionId>` (hash).
- También se mantiene un set `user_sessions:<userId>` con los IDs de sesión activos.
- `registerDummySession` crea una entrada mínima cuando `registerSession` falla (fallback seguro).
- `touchSession` actualiza `lastActiveAt` sin bloquear.

### Tauri: cambios necesarios

Cuando la app migre a Tauri, estos son los puntos a modificar:

1. **Cookie → Token**: Tauri no maneja bien cookies `SameSite=None; Secure` con protocolo `tauri://` o `https://localhost`. Se recomienda migrar a token-based auth:
   - Backend devuelve token JWT en el callback en vez de cookie
   - Frontend almacena token en memoria/storage y lo envía en header `Authorization: Bearer <token>`
2. **CORS**: Tauri puede necesitar `tauri://localhost` o `tauri://<appname>` en `CORS_ORIGIN`.
3. **`window.location.assign`**: En Tauri, los redirects a WorkOS AuthKit pueden necesitar el plugin `@tauri-apps/plugin-shell` para abrir el navegador externo.
4. **`fetch`**: Tauri usa su propio `fetch` (o plugin HTTP) que puede tener limitaciones con cookies. Revisar `@tauri-apps/plugin-http`.

---

## Comandos útiles

```bash
# Ver sesiones activas en Redis
redis-cli keys 'session:*'
redis-cli HGETALL session:<id>

# Ver tenants y usuarios en DB
cd apps/back && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.tenant.findMany().then(r => console.log(JSON.stringify(r, null, 2))).finally(() => p.\$disconnect());
"

# Lint
npx ultracite check

# Build frontend
cd apps/front && npx vite build
```
