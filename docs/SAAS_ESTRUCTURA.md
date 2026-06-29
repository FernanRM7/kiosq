# POS SaaS Offline-First — Estructura Completa del Proyecto

> Versión mejorada con mejores prácticas, decisiones de diseño explicadas y referencias a proyectos similares de alto nivel (Square, Shopify POS, Toast POS, Loyverse).

---

## 1. Visión general del sistema

### Qué es

Un sistema de punto de venta (POS) entregado como SaaS con las siguientes propiedades fundamentales:

- **Offline-first real**: las operaciones críticas (ventas, inventario) funcionan sin internet y se sincronizan cuando hay conexión.
- **Multi-tenant**: múltiples empresas comparten la infraestructura pero tienen datos completamente aislados.
- **Multiplataforma**: web (PWA), escritorio (Electron) y móvil (React Native) comparten la misma lógica de negocio.
- **Modular y escalable**: cada dominio de negocio es un módulo independiente que puede evolucionar sin romper los demás.

### Por qué esta arquitectura

Los mejores sistemas POS modernos (Square, Toast, Shopify POS) son todos offline-first por una razón simple: una caja registradora que se detiene cuando cae el internet destruye la experiencia del negocio. La arquitectura aquí planteada replica ese enfoque con tecnología open-source y costos bajos al inicio.

---

## 2. Arquitectura del sistema (alto nivel)

```
┌─────────────────────────────────────────────────────────────────┐
│  CLIENTES (Edge)                                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ PWA/Web  │  │ Electron │  │  React   │  │ Landing  │      │
│  │  Next.js │  │ Desktop  │  │  Native  │  │  Next.js │      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────┘      │
│       │              │              │                           │
│  ┌────▼──────────────▼──────────────▼────┐                    │
│  │         CAPA OFFLINE LOCAL             │                    │
│  │  SQLite (Electron) / IndexedDB (PWA)   │                    │
│  │  Cifrado con SQLCipher / crypto-js     │                    │
│  └────────────────┬───────────────────────┘                    │
│                   │                                             │
│  ┌────────────────▼───────────────────────┐                    │
│  │           SYNC ENGINE                  │                    │
│  │  Cola de eventos + reintentos          │                    │
│  │  Deduplicación + resolución conflictos │                    │
│  └────────────────┬───────────────────────┘                    │
└───────────────────┼─────────────────────────────────────────────┘
                    │ HTTPS / WebSocket
┌───────────────────▼─────────────────────────────────────────────┐
│  CLOUD (Backend)                                                │
│                                                                 │
│  ┌──────────────────────────────────────┐                      │
│  │       API GATEWAY (NestJS)           │                      │
│  │  Rate limiting · Auth · Logging      │                      │
│  └────────────────┬─────────────────────┘                      │
│                   │                                             │
│  ┌────────────────▼─────────────────────────────────────────┐  │
│  │                   MÓDULOS DE NEGOCIO                     │  │
│  │  Auth · Tenants · Users · Devices · Sales · Inventory   │  │
│  │  Billing · Reports · Notifications · Sync               │  │
│  └────────────────┬─────────────────────────────────────────┘  │
│                   │                                             │
│  ┌────────────────▼─────────────────────────────────────────┐  │
│  │                   DATOS                                  │  │
│  │  PostgreSQL (RLS multi-tenant) · Redis · S3/Storage      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              SERVICIOS EXTERNOS                          │  │
│  │  SAT CFDI · Stripe · Mercado Pago · Email · SMS · Push  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Estructura del monorepo

```
/pos-saas/
│
├── apps/
│   ├── backend/              ← API principal (NestJS)
│   ├── pos-web/              ← POS en navegador (Next.js PWA)
│   ├── desktop/              ← POS escritorio (Electron + React)
│   ├── mobile/               ← App de monitoreo (React Native)
│   └── landing/              ← Página marketing + planes (Next.js)
│
├── packages/
│   ├── ui/                   ← Componentes compartidos (shadcn/ui base)
│   ├── types/                ← Tipos TypeScript compartidos
│   ├── utils/                ← Helpers comunes (formateo, cálculos)
│   ├── sync-engine/          ← Motor de sincronización offline [CRÍTICO]
│   ├── auth/                 ← Lógica de autenticación compartida
│   ├── validators/           ← Schemas Zod compartidos
│   └── config/               ← Variables de entorno tipadas
│
├── prisma/
│   ├── schema.prisma         ← Schema principal
│   ├── migrations/           ← Migraciones versionadas
│   └── seeds/                ← Datos de prueba por ambiente
│
├── docker/
│   ├── docker-compose.yml          ← Desarrollo local
│   ├── docker-compose.prod.yml     ← Producción
│   └── Dockerfile.backend          ← Imagen del backend
│
├── .github/
│   └── workflows/
│       ├── ci.yml            ← Tests + lint en cada PR
│       ├── deploy-staging.yml
│       └── deploy-prod.yml
│
├── turbo.json                ← Configuración Turborepo (build pipeline)
├── pnpm-workspace.yaml       ← Workspace definition
└── package.json
```

**Por qué monorepo con Turborepo:** permite compartir tipos, validadores y el sync engine entre todas las apps sin duplicar código. Turborepo cachea builds y solo re-ejecuta lo que cambió. Es el mismo enfoque que usa Vercel internamente.

---

## 4. Backend — estructura detallada

```
apps/backend/src/
│
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts       ← Endpoints: login, refresh, logout
│   │   ├── auth.service.ts          ← Lógica: validación, generación tokens
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts      ← Passport: valida access token
│   │   │   └── refresh.strategy.ts  ← Passport: valida refresh token
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts    ← Guard: protege rutas autenticadas
│   │   │   └── roles.guard.ts       ← Guard: verifica roles RBAC
│   │   └── dto/
│   │       ├── login.dto.ts
│   │       └── refresh.dto.ts
│   │
│   ├── tenants/
│   │   ├── tenants.module.ts
│   │   ├── tenants.service.ts       ← CRUD tenants, gestión plan
│   │   ├── tenants.repository.ts    ← Abstracción DB (Repository Pattern)
│   │   └── dto/
│   │       ├── create-tenant.dto.ts
│   │       └── update-tenant.dto.ts
│   │
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.service.ts         ← CRUD usuarios por tenant
│   │   ├── users.repository.ts
│   │   └── dto/
│   │
│   ├── devices/
│   │   ├── devices.module.ts
│   │   ├── devices.service.ts       ← Registro y validación de dispositivos
│   │   ├── devices.repository.ts
│   │   └── dto/
│   │       └── register-device.dto.ts
│   │
│   ├── sales/
│   │   ├── sales.module.ts
│   │   ├── sales.controller.ts      ← POST /sales, GET /sales, GET /sales/:id
│   │   ├── sales.service.ts         ← Lógica: crear venta, calcular totales, pagos
│   │   ├── sales.repository.ts
│   │   └── dto/
│   │       ├── create-sale.dto.ts
│   │       └── sale-item.dto.ts
│   │
│   ├── inventory/
│   │   ├── inventory.module.ts
│   │   ├── inventory.controller.ts  ← GET/POST /products, /categories
│   │   ├── inventory.service.ts     ← Lógica: stock, alertas bajo stock
│   │   ├── inventory.repository.ts
│   │   └── dto/
│   │       ├── create-product.dto.ts
│   │       └── update-stock.dto.ts
│   │
│   ├── sync/
│   │   ├── sync.module.ts
│   │   ├── sync.controller.ts       ← POST /sync/push, GET /sync/pull
│   │   ├── sync.service.ts          ← Lógica: merge, deduplicación, conflictos
│   │   ├── sync.repository.ts
│   │   └── dto/
│   │       └── sync-batch.dto.ts
│   │
│   ├── billing/
│   │   ├── billing.module.ts
│   │   ├── billing.service.ts       ← Suscripciones, planes, cobros Stripe
│   │   ├── webhooks/
│   │   │   └── stripe.webhook.ts    ← Recibe eventos de Stripe
│   │   └── dto/
│   │
│   ├── reports/
│   │   ├── reports.module.ts
│   │   ├── reports.controller.ts    ← GET /reports/sales, /reports/inventory
│   │   ├── reports.service.ts       ← Queries agregadas, exportación CSV/PDF
│   │   └── dto/
│   │
│   └── notifications/
│       ├── notifications.module.ts
│       └── notifications.service.ts ← Email (Resend), Push, SMS (Twilio)
│
├── common/
│   ├── decorators/
│   │   ├── tenant.decorator.ts      ← Extrae tenantId del JWT
│   │   └── roles.decorator.ts       ← @Roles('admin', 'manager')
│   ├── filters/
│   │   └── http-exception.filter.ts ← Formato estándar de errores
│   ├── interceptors/
│   │   ├── logging.interceptor.ts   ← Log de cada request/response
│   │   └── transform.interceptor.ts ← Envuelve respuestas en { data, meta }
│   ├── middleware/
│   │   └── tenant.middleware.ts     ← Inyecta tenantId en cada request
│   └── pipes/
│       └── validation.pipe.ts       ← Validación global con class-validator
│
├── config/
│   ├── database.config.ts           ← Conexión PostgreSQL
│   ├── redis.config.ts              ← Conexión Redis
│   ├── jwt.config.ts                ← Secrets, expiración tokens
│   └── app.config.ts                ← Puerto, CORS, ambiente
│
├── prisma/
│   └── prisma.service.ts            ← Singleton del cliente Prisma
│
└── main.ts                          ← Bootstrap: Helmet, CORS, Swagger, pipes
```

---

## 5. Base de datos — schema completo

### Estrategia multi-tenant: Row-Level Security (RLS)

Todos los registros tienen `tenant_id`. PostgreSQL RLS aplica automáticamente el filtro en cada query usando `SET app.current_tenant = 'uuid'` en la sesión. Esto evita que una bug exponga datos de otro tenant.

**Alternativa descartada:** schemas separados por tenant. Más aislamiento pero migraciones complejas con 100+ tenants.

```sql
-- Habilitar RLS en tablas sensibles
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sales
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

### Entidades y su propósito

```prisma
// ─── MULTI-TENANCY ───────────────────────────────────────────

model Plan {
  id            String       @id @default(cuid())
  name          String       // "Básico", "Pro", "Enterprise"
  maxDevices    Int          // límite de dispositivos activos
  maxUsers      Int
  priceMonthly  Decimal      @db.Decimal(10, 2)
  features      Json         // flags: { cfdi: true, reports: true }
  tenants       Tenant[]
  createdAt     DateTime     @default(now())
}
// Qué hace: define las capacidades y límites de cada nivel de suscripción.

model Tenant {
  id            String       @id @default(cuid())
  name          String       // "Tienda ABC S.A."
  slug          String       @unique  // "tienda-abc" → subdominio futuro
  planId        String
  plan          Plan         @relation(fields: [planId], references: [id])
  status        TenantStatus @default(ACTIVE)  // ACTIVE | SUSPENDED | CANCELLED
  trialEndsAt   DateTime?
  subscriptions Subscription[]
  users         User[]
  branches      Branch[]
  devices       Device[]
  createdAt     DateTime     @default(now())
}
// Qué hace: representa una empresa cliente. Es el contenedor raíz de todos sus datos.

model Subscription {
  id              String   @id @default(cuid())
  tenantId        String
  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  stripeSubId     String?  @unique  // ID suscripción en Stripe
  status          String   // active | past_due | canceled
  currentPeriodEnd DateTime
  cancelAtPeriodEnd Boolean @default(false)
}
// Qué hace: rastrea el estado de pago del tenant. Stripe envía webhooks que actualizan este registro.

// ─── USUARIOS Y ACCESO ────────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  tenantId      String
  tenant        Tenant    @relation(fields: [tenantId], references: [id])
  email         String
  passwordHash  String
  name          String
  role          Role      @default(CASHIER)  // ADMIN | MANAGER | CASHIER
  branchId      String?   // sucursal asignada (null = acceso a todas)
  branch        Branch?   @relation(fields: [branchId], references: [id])
  isActive      Boolean   @default(true)
  lastLoginAt   DateTime?
  sessions      Session[]
  sales         Sale[]
  createdAt     DateTime  @default(now())

  @@unique([tenantId, email])  // email único por tenant
}
// Qué hace: empleado o administrador de una tienda. El rol determina qué puede ver y hacer.

model Session {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  refreshToken String   @unique
  deviceId     String?
  expiresAt    DateTime
  createdAt    DateTime @default(now())
}
// Qué hace: almacena refresh tokens. Permite revocar sesiones por dispositivo.

model Device {
  id          String     @id @default(cuid())
  tenantId    String
  tenant      Tenant     @relation(fields: [tenantId], references: [id])
  name        String     // "Caja 1", "Terminal entrada"
  fingerprint String     // hash del dispositivo físico
  isActive    Boolean    @default(true)
  lastSeenAt  DateTime?
  offlineToken String?   // token firmado para modo offline extendido
  sales       Sale[]
  createdAt   DateTime   @default(now())

  @@unique([tenantId, fingerprint])
}
// Qué hace: registra cada terminal física. El plan limita cuántos dispositivos activos puede tener un tenant.

// ─── ESTRUCTURA COMERCIAL ─────────────────────────────────────

model Branch {
  id        String    @id @default(cuid())
  tenantId  String
  tenant    Tenant    @relation(fields: [tenantId], references: [id])
  name      String    // "Sucursal Centro", "Local Norte"
  address   String?
  phone     String?
  isActive  Boolean   @default(true)
  users     User[]
  sales     Sale[]
  products  ProductBranch[]
}
// Qué hace: representa una ubicación física del negocio. El inventario puede variar por sucursal.

// ─── INVENTARIO ───────────────────────────────────────────────

model Category {
  id       String    @id @default(cuid())
  tenantId String
  name     String    // "Bebidas", "Electrónicos"
  products Product[]

  @@unique([tenantId, name])
}

model Product {
  id          String   @id @default(cuid())
  tenantId    String
  sku         String   // código interno
  barcode     String?  // código de barras EAN/UPC
  name        String
  description String?
  price       Decimal  @db.Decimal(10, 2)
  cost        Decimal? @db.Decimal(10, 2)  // para calcular margen
  taxRate     Decimal  @default(0) @db.Decimal(5, 4)  // 0.16 = 16% IVA
  categoryId  String?
  category    Category? @relation(fields: [categoryId], references: [id])
  isActive    Boolean  @default(true)
  imageUrl    String?
  branches    ProductBranch[]
  saleItems   SaleItem[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, sku])
}
// Qué hace: catálogo de productos del tenant. El precio puede variar por sucursal en ProductBranch.

model ProductBranch {
  productId String
  product   Product @relation(fields: [productId], references: [id])
  branchId  String
  branch    Branch  @relation(fields: [branchId], references: [id])
  stock     Int     @default(0)
  minStock  Int     @default(5)   // alerta de bajo stock
  price     Decimal? @db.Decimal(10, 2)  // precio local (sobreescribe Product.price)

  @@id([productId, branchId])
}
// Qué hace: stock e inventario específico por sucursal. Permite precios diferenciados.

model StockMovement {
  id         String           @id @default(cuid())
  tenantId   String
  productId  String
  product    Product          @relation(fields: [productId], references: [id])
  branchId   String
  type       StockMovementType  // SALE | PURCHASE | ADJUSTMENT | RETURN | TRANSFER
  quantity   Int              // positivo = entrada, negativo = salida
  reason     String?
  userId     String
  createdAt  DateTime         @default(now())
}
// Qué hace: auditoría de todos los movimientos de inventario. Permite trazabilidad completa.

// ─── VENTAS ───────────────────────────────────────────────────

model Sale {
  id           String      @id @default(cuid())
  tenantId     String
  tenant       Tenant      @relation(fields: [tenantId], references: [id])
  branchId     String
  branch       Branch      @relation(fields: [branchId], references: [id])
  deviceId     String?
  device       Device?     @relation(fields: [deviceId], references: [id])
  userId       String
  user         User        @relation(fields: [userId], references: [id])
  status       SaleStatus  @default(COMPLETED)  // COMPLETED | CANCELLED | REFUNDED
  subtotal     Decimal     @db.Decimal(10, 2)
  taxAmount    Decimal     @db.Decimal(10, 2)
  discountAmount Decimal   @db.Decimal(10, 2) @default(0)
  total        Decimal     @db.Decimal(10, 2)
  items        SaleItem[]
  payments     Payment[]
  cfdiId       String?     // folio fiscal SAT (si aplica)
  offlineId    String?     @unique  // ID generado offline (UUID v4)
  syncedAt     DateTime?   // cuándo se sincronizó al cloud
  createdAt    DateTime    @default(now())

  @@index([tenantId, createdAt])  // optimiza reportes por fecha
  @@index([tenantId, branchId])
}
// Qué hace: registro de cada transacción. offlineId permite deduplicar ventas creadas sin conexión.

model SaleItem {
  id         String   @id @default(cuid())
  saleId     String
  sale       Sale     @relation(fields: [saleId], references: [id])
  productId  String
  product    Product  @relation(fields: [productId], references: [id])
  quantity   Int
  unitPrice  Decimal  @db.Decimal(10, 2)  // precio al momento de la venta
  taxRate    Decimal  @db.Decimal(5, 4)
  subtotal   Decimal  @db.Decimal(10, 2)
}
// Qué hace: cada línea de la venta. El precio se guarda en el momento (no cambia si el producto cambia de precio).

model Payment {
  id        String        @id @default(cuid())
  saleId    String
  sale      Sale          @relation(fields: [saleId], references: [id])
  method    PaymentMethod  // CASH | CARD | TRANSFER | QR | CREDIT
  amount    Decimal       @db.Decimal(10, 2)
  reference String?       // referencia terminal, número de autorización
  status    String        @default("COMPLETED")
}
// Qué hace: una venta puede tener múltiples formas de pago (pago mixto efectivo + tarjeta).

// ─── SINCRONIZACIÓN ───────────────────────────────────────────

model SyncEvent {
  id          String      @id @default(cuid())
  tenantId    String
  deviceId    String
  entityType  String      // "sale" | "product" | "stock"
  entityId    String      // ID del registro afectado
  operation   SyncOp      // CREATE | UPDATE | DELETE
  payload     Json        // datos completos del registro
  clientTs    DateTime    // timestamp del cliente (para resolución de conflictos)
  serverTs    DateTime    @default(now())
  status      SyncStatus  @default(PENDING)  // PENDING | APPLIED | CONFLICT | REJECTED
  conflictNote String?    // descripción del conflicto si aplica
}
// Qué hace: log de todos los eventos de sincronización. Permite auditoría y replayabilidad.

// ─── ENUMS ────────────────────────────────────────────────────

enum Role            { ADMIN MANAGER CASHIER }
enum TenantStatus    { ACTIVE SUSPENDED CANCELLED TRIAL }
enum SaleStatus      { COMPLETED CANCELLED REFUNDED PARTIAL }
enum PaymentMethod   { CASH CARD TRANSFER QR CREDIT }
enum StockMovementType { SALE PURCHASE ADJUSTMENT RETURN TRANSFER }
enum SyncOp          { CREATE UPDATE DELETE }
enum SyncStatus      { PENDING APPLIED CONFLICT REJECTED }
```

---

## 6. Motor de sincronización offline (Sync Engine)

Este es el componente más crítico y diferenciador del sistema. Se vive en `packages/sync-engine/`.

### Flujo completo

```
[CLIENTE SIN CONEXIÓN]
Venta creada
  → Guardar en SQLite/IndexedDB con offlineId (UUID v4)
  → Agregar evento a SyncQueue local
  → Reducir stock local inmediatamente

[CLIENTE RECUPERA CONEXIÓN]
SyncEngine detecta conexión
  → Leer cola de eventos pendientes
  → POST /sync/push con batch de eventos
  → Backend procesa cada evento:
      ¿Ya existe offlineId? → deduplicar (idempotente)
      ¿Conflicto de stock?  → aplicar regla de resolución
      ¿OK?                  → persistir en PostgreSQL, emitir respuesta
  → Cliente recibe respuesta:
      APPLIED   → marcar evento como sincronizado
      CONFLICT  → aplicar dato del servidor (server wins)
      REJECTED  → notificar al usuario

[CLIENTE SE RECONECTA DESPUÉS DE TIEMPO LARGO]
GET /sync/pull?since=lastSyncTimestamp
  → Servidor devuelve todos los cambios desde esa fecha
  → Cliente aplica delta al estado local
```

### Estrategia de resolución de conflictos

| Escenario                                  | Regla                           | Razón                              |
| ------------------------------------------ | ------------------------------- | ---------------------------------- |
| Misma venta creada dos veces               | Deduplicar por `offlineId`      | UUID garantiza unicidad            |
| Stock negativo                             | Rechazar y notificar            | Integridad de inventario           |
| Precio del producto cambió durante offline | Mantener precio de la venta     | El cliente tenía el precio vigente |
| Mismo producto editado en dos dispositivos | Last-write-wins por `updatedAt` | Suficiente para catálogo           |
| Ajuste de inventario vs venta simultánea   | Server wins                     | El server tiene visión global      |

### Estructura del paquete

```
packages/sync-engine/
├── queue.ts           ← Cola persistente (IndexedDB/SQLite según plataforma)
├── engine.ts          ← Orquestador: detecta conexión, procesa cola
├── push.ts            ← Envía eventos al servidor en batches
├── pull.ts            ← Descarga cambios del servidor
├── conflict.ts        ← Lógica de resolución de conflictos
├── deduplicator.ts    ← Verifica offlineId antes de aplicar
├── retry.ts           ← Exponential backoff con jitter
└── types.ts           ← SyncEvent, SyncResult, SyncStatus
```

### Configuración de reintentos

```typescript
// retry.ts — Exponential backoff con jitter
const delay = Math.min(
  BASE_DELAY * Math.pow(2, attempt) + Math.random() * 1000,
  MAX_DELAY // cap en 30 segundos
);
// Intento 1: ~1s, Intento 2: ~2s, Intento 3: ~4s ... máx 30s
```

---

## 7. Autenticación y seguridad

### Flujo de tokens

```
Login exitoso
  → Access Token  (JWT RS256, expira en 15 min)
  → Refresh Token (opaco, almacenado en DB, expira en 30 días)

Cada request autenticado:
  Authorization: Bearer <access_token>
  → Guard valida firma RS256
  → Middleware extrae tenantId del payload
  → RLS de PostgreSQL filtra datos automáticamente

Access token expirado:
  POST /auth/refresh con refresh_token
  → Validar contra DB (existe y no revocado)
  → Emitir nuevo par de tokens (rotación)
  → Revocar refresh token anterior (token rotation)
```

**Por qué RS256 (asimétrico) en lugar de HS256:**
La clave privada solo existe en el backend. Los servicios que solo necesitan verificar tokens (edge functions, workers) pueden hacerlo con la clave pública sin acceso a secretos.

### Offline token (para modo sin conexión extendido)

```json
{
  "tenantId": "uuid",
  "deviceId": "uuid",
  "allowedOps": ["create_sale", "read_products"],
  "issuedAt": 1716000000,
  "expiresAt": 1716604800,
  "signature": "RS256_firma"
}
```

Este token se almacena cifrado en el dispositivo. Permite validar localmente si el dispositivo tiene permiso para operar, incluso sin internet, durante un período máximo configurable (default: 7 días).

### RBAC — Roles y permisos

| Permiso                   | ADMIN | MANAGER |   CASHIER    |
| ------------------------- | :---: | :-----: | :----------: |
| Crear/editar productos    |   ✓   |    ✓    |      ✗       |
| Ver reportes              |   ✓   |    ✓    |      ✗       |
| Crear ventas              |   ✓   |    ✓    |      ✓       |
| Aplicar descuentos        |   ✓   |    ✓    |   Límite %   |
| Gestionar usuarios        |   ✓   |    ✗    |      ✗       |
| Ver configuración billing |   ✓   |    ✗    |      ✗       |
| Cancelar ventas           |   ✓   |    ✓    | Solo propias |

### Capas de seguridad backend

| Capa              | Herramienta           | Qué protege                      |
| ----------------- | --------------------- | -------------------------------- |
| Headers HTTP      | Helmet                | XSS, clickjacking, MIME sniffing |
| CORS              | NestJS CORS           | Origenes no autorizados          |
| Rate limiting     | `@nestjs/throttler`   | Brute force, DDoS básico         |
| Validación input  | class-validator + Zod | SQL Injection, datos malformados |
| Autenticación     | Passport + JWT RS256  | Acceso no autorizado             |
| Autorización      | RBAC guards           | Acceso entre roles               |
| Aislamiento datos | PostgreSQL RLS        | Filtración entre tenants         |
| Cifrado local     | SQLCipher / crypto-js | Robo de dispositivo              |
| Secrets           | Variables de entorno  | Credenciales en código           |

---

## 8. APIs

### Convención de rutas

```
/api/v1/{recurso}
```

Todos los endpoints protegidos reciben el tenantId del JWT, nunca de la URL (previene IDOR).

### Endpoints principales

```
AUTH
  POST   /api/v1/auth/login          ← credenciales → tokens
  POST   /api/v1/auth/refresh        ← refresh token → nuevos tokens
  POST   /api/v1/auth/logout         ← revoca refresh token
  POST   /api/v1/auth/register       ← crear cuenta (solo en landing)

SALES
  POST   /api/v1/sales               ← crear venta
  GET    /api/v1/sales               ← listar ventas (con filtros fecha, estado)
  GET    /api/v1/sales/:id           ← detalle de venta
  POST   /api/v1/sales/:id/refund    ← devolución

INVENTORY
  GET    /api/v1/products            ← catálogo con stock
  POST   /api/v1/products            ← crear producto [MANAGER+]
  PATCH  /api/v1/products/:id        ← actualizar producto [MANAGER+]
  POST   /api/v1/products/:id/stock  ← ajuste de inventario [MANAGER+]

SYNC
  POST   /api/v1/sync/push           ← cliente sube eventos offline
  GET    /api/v1/sync/pull           ← cliente descarga cambios (since=timestamp)
  GET    /api/v1/sync/status         ← estado del dispositivo

REPORTS
  GET    /api/v1/reports/sales       ← ventas por período, cajero, producto
  GET    /api/v1/reports/inventory   ← productos bajo stock, movimientos
  GET    /api/v1/reports/export      ← descarga CSV/PDF

BILLING
  GET    /api/v1/billing/plan        ← plan actual y uso
  POST   /api/v1/billing/subscribe   ← cambiar plan
  GET    /api/v1/billing/invoices    ← historial de facturas

ADMIN
  GET    /api/v1/admin/tenants       ← lista tenants [SUPER_ADMIN]
  PATCH  /api/v1/admin/tenants/:id   ← suspender/activar tenant
```

### Formato estándar de respuestas

```json
// Éxito
{
  "data": { ... },
  "meta": { "page": 1, "total": 150, "perPage": 20 }
}

// Error
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Stock insuficiente para Coca-Cola 600ml",
    "details": { "productId": "xxx", "requested": 5, "available": 2 }
  }
}
```

---

## 9. Frontend — estructura y estado

### POS Web (apps/pos-web/)

```
apps/pos-web/
├── app/                         ← Next.js App Router
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (pos)/                   ← Rutas protegidas del POS
│   │   ├── layout.tsx           ← Shell: sidebar, topbar, estado offline
│   │   ├── sale/page.tsx        ← Pantalla de venta (pantalla principal)
│   │   ├── products/page.tsx    ← Catálogo e inventario
│   │   ├── reports/page.tsx     ← Dashboard de reportes
│   │   └── settings/page.tsx    ← Configuración del negocio
│   └── api/                     ← API routes de Next.js (webhooks, auth)
│
├── components/
│   ├── pos/
│   │   ├── ProductGrid.tsx      ← Grid de productos con búsqueda/filtro
│   │   ├── Cart.tsx             ← Carrito de compra actual
│   │   ├── PaymentModal.tsx     ← Modal de cobro (efectivo, tarjeta)
│   │   ├── OfflineBanner.tsx    ← Indicador de modo offline
│   │   └── ReceiptPrinter.tsx   ← Impresión de ticket (WebUSB)
│   ├── inventory/
│   │   ├── ProductForm.tsx
│   │   └── StockAdjustment.tsx
│   └── shared/
│       ├── DataTable.tsx
│       └── DateRangePicker.tsx
│
├── stores/                      ← Zustand stores
│   ├── cart.store.ts            ← Estado del carrito actual
│   ├── sync.store.ts            ← Estado del sync engine
│   └── auth.store.ts            ← Usuario, permisos, tenant
│
├── hooks/
│   ├── useOfflineStatus.ts      ← Detecta conexión/desconexión
│   ├── useSyncEngine.ts         ← Controla el sync, expone estado
│   └── useProducts.ts           ← React Query: productos con cache offline
│
└── lib/
    ├── db/                      ← IndexedDB con Dexie.js
    │   ├── schema.ts            ← Tablas locales (products, sales, queue)
    │   └── migrations.ts        ← Versiones del schema local
    └── api.ts                   ← Cliente Axios con interceptores de auth
```

### Gestión de estado

```
ESTADO GLOBAL (Zustand)
  cart.store        → carrito activo (en memoria, se pierde al cerrar)
  auth.store        → usuario autenticado, tokens, permisos
  sync.store        → cola pendiente, estado conexión, errores sync

ESTADO SERVIDOR (React Query / TanStack Query)
  useProducts()     → catálogo con cache de 5 minutos
  useSales()        → historial de ventas paginado
  useReports()      → datos de reportes (stale-while-revalidate)

ESTADO LOCAL PERSISTENTE (Dexie/IndexedDB)
  products          → copia local del catálogo (se actualiza al sincronizar)
  pendingSales      → ventas creadas offline esperando sync
  syncQueue         → cola de eventos pendientes de enviar
```

**Por qué Zustand sobre Redux:** para este proyecto el estado es simple. Zustand tiene 0 boilerplate, funciona con TypeScript perfectamente y tiene tamaño ~1KB. Redux es overkill aquí.

---

## 10. Stack tecnológico completo

### Backend

| Tecnología        | Versión | Qué hace exactamente                                                |
| ----------------- | ------- | ------------------------------------------------------------------- |
| Node.js           | 20 LTS  | Runtime. Se elige 20 LTS por soporte hasta 2026.                    |
| NestJS            | 10      | Framework con módulos, DI, guards, interceptores.                   |
| Prisma            | 5       | ORM con migraciones tipadas y cliente generado.                     |
| PostgreSQL        | 16      | BD principal. RLS para multi-tenant.                                |
| Redis             | 7       | Cache de catálogo, sesiones, rate limiting, BullMQ queues.          |
| BullMQ            | 4       | Colas de trabajo para reportes pesados y notificaciones asíncronas. |
| Passport.js       | -       | Estrategias de autenticación (JWT, local).                          |
| class-validator   | -       | Validación de DTOs con decoradores.                                 |
| Zod               | 3       | Validación de schemas compartidos en monorepo.                      |
| Helmet            | -       | Cabeceras HTTP de seguridad.                                        |
| @nestjs/throttler | -       | Rate limiting por IP y por tenant.                                  |
| Swagger/OpenAPI   | -       | Documentación automática de la API.                                 |

### Frontend

| Tecnología        | Qué hace exactamente                                      |
| ----------------- | --------------------------------------------------------- |
| Next.js 14        | App Router, SSR para landing, RSC para dashboard inicial. |
| React 18          | Concurrent features, Suspense para loading states.        |
| TailwindCSS 3     | Estilos utility-first. Consistente entre apps.            |
| shadcn/ui         | Componentes accesibles (Radix UI) con estilos Tailwind.   |
| TanStack Query 5  | Fetching, caching, sincronización con server.             |
| Zustand 4         | Estado global liviano.                                    |
| Dexie.js          | IndexedDB con API tipo Promise y esquemas.                |
| React Hook Form   | Formularios con validación Zod.                           |
| Recharts          | Gráficas para reportes.                                   |
| Electron 28       | Wrapper desktop. Acceso a SQLite, impresoras, USB.        |
| React Native 0.73 | App móvil (expo-managed workflow).                        |

### Infraestructura

| Tecnología         | Entorno                  | Qué hace                                     |
| ------------------ | ------------------------ | -------------------------------------------- |
| Docker Compose     | Dev local                | Levanta postgres + redis + backend juntos.   |
| Turborepo          | CI/CD                    | Cachea builds, ejecuta tareas en paralelo.   |
| GitHub Actions     | CI/CD                    | Lint + tests en PRs, deploy en merge a main. |
| Vercel             | Frontend prod            | Deploy automático de pos-web y landing.      |
| Railway / Fly.io   | Backend prod             | Backend NestJS en contenedor.                |
| Supabase           | DB prod (Fase 1)         | PostgreSQL managed con RLS.                  |
| AWS RDS + ECS      | DB/Backend prod (Fase 2) | Migración cuando Railway sea caro.           |
| Cloudflare R2 / S3 | Almacenamiento           | Imágenes de productos, exports.              |

---

## 11. Docker — entorno de desarrollo

```yaml
# docker/docker-compose.yml

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: pos_dev
      POSTGRES_USER: pos_user
      POSTGRES_PASSWORD: pos_secret
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pos_user"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  backend:
    build:
      context: ../apps/backend
      dockerfile: ../../docker/Dockerfile.backend
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://pos_user:pos_secret@postgres:5432/pos_dev
      REDIS_URL: redis://redis:6379
      JWT_PRIVATE_KEY: ${JWT_PRIVATE_KEY}
      JWT_PUBLIC_KEY: ${JWT_PUBLIC_KEY}
      NODE_ENV: development
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ../apps/backend/src:/app/src # hot reload en dev
    command: pnpm dev

volumes:
  postgres_data:
  redis_data:
```

```dockerfile
# docker/Dockerfile.backend

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
EXPOSE 3001
CMD ["node", "dist/main.js"]
```

---

## 12. CI/CD con GitHub Actions

```yaml
# .github/workflows/ci.yml

name: CI

on:
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 8 }
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: "pnpm" }

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm turbo lint

      - name: Type check
        run: pnpm turbo type-check

      - name: Unit tests
        run: pnpm turbo test

      - name: Integration tests (backend)
        run: pnpm --filter backend test:e2e
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
```

---

## 13. Testing — estrategia completa

### Pirámide de tests

```
         [E2E]        ← Cypress/Playwright: flujos críticos del usuario
        /     \          (login → venta → ticket) — pocos, lentos, confiables
       /       \
    [Integration]    ← Supertest: módulos completos (auth flow, sync)
   /             \
  [Unit Tests]        ← Jest: servicios, utils, sync engine — muchos, rápidos
```

### Tests prioritarios por módulo

| Módulo           | Tipo               | Qué probar                                        |
| ---------------- | ------------------ | ------------------------------------------------- |
| Sync Engine      | Unit               | Deduplicación, resolución conflictos, retry logic |
| Auth Service     | Unit + Integration | Login, refresh, revocación, RBAC                  |
| Sales Service    | Unit + Integration | Crear venta, stock negativo, pago mixto           |
| Inventory        | Unit               | Ajuste stock, alertas bajo stock                  |
| Multi-tenant RLS | Integration        | Que un tenant no vea datos de otro                |
| Flujo de venta   | E2E                | Buscar producto → agregar → cobrar → ticket       |

### Ejemplo de test unitario del sync engine

```typescript
// packages/sync-engine/__tests__/deduplicator.test.ts

describe("SyncDeduplicator", () => {
  it("should not apply an event if offlineId already exists in DB", async () => {
    const existingSale = await createSaleInDB({ offlineId: "uuid-abc" });
    const event = buildSyncEvent({
      offlineId: "uuid-abc",
      operation: "CREATE",
    });

    const result = await deduplicator.check(event);

    expect(result.isDuplicate).toBe(true);
    expect(result.existingId).toBe(existingSale.id);
  });
});
```

---

## 14. Integraciones externas

### SAT CFDI (facturación México)

- Proveedor recomendado: **Facturama** o **SW Sapien** (APIs REST, no SAP).
- Se genera el CFDI después de que la venta es sincronizada y marcada como COMPLETED.
- El folio fiscal se guarda en `Sale.cfdiId`.
- Solo se intenta si el tenant tiene `features.cfdi = true` en su plan.

### Pagos

| Proveedor    | Uso                                    | Integración            |
| ------------ | -------------------------------------- | ---------------------- |
| Stripe       | Cobro de suscripciones SaaS            | SDK Node.js + Webhooks |
| Mercado Pago | Cobro en punto de venta (México/LATAM) | Point SDK + QR         |
| Conekta      | Alternativa para México                | API REST               |

### Notificaciones

| Canal               | Proveedor         | Cuándo                                |
| ------------------- | ----------------- | ------------------------------------- |
| Email transaccional | Resend o SendGrid | Registro, factura, alerta stock       |
| Push                | Firebase FCM      | Bajo stock, sincronización completada |
| SMS                 | Twilio            | Verificación 2FA (futuro)             |

---

## 15. Planes SaaS y control de límites

### Definición de planes

| Feature              | Básico   | Pro          | Enterprise |
| -------------------- | -------- | ------------ | ---------- |
| Dispositivos activos | 2        | 5            | Ilimitado  |
| Usuarios             | 3        | 10           | Ilimitado  |
| Sucursales           | 1        | 3            | Ilimitado  |
| CFDI/Facturación     | ✗        | ✓            | ✓          |
| Reportes avanzados   | ✗        | ✓            | ✓          |
| API acceso           | ✗        | ✗            | ✓          |
| Soporte              | Email    | Email + Chat | Dedicado   |
| Precio/mes           | $299 MXN | $799 MXN     | A cotizar  |

### Cómo se aplican los límites en código

```typescript
// tenants.service.ts
async validateDeviceLimit(tenantId: string): Promise<void> {
  const tenant = await this.tenantsRepository.findWithPlan(tenantId);
  const activeDevices = await this.devicesRepository.countActive(tenantId);

  if (activeDevices >= tenant.plan.maxDevices) {
    throw new ForbiddenException({
      code: 'DEVICE_LIMIT_REACHED',
      message: `Tu plan ${tenant.plan.name} permite máximo ${tenant.plan.maxDevices} dispositivos.`,
      upgradeUrl: '/billing/upgrade'
    });
  }
}
```

---

## 16. Escalabilidad — estrategia por fases

### Fase 1: Validación (0–6 meses) | Costo ≈ $0–$50/mes

- **Frontend:** Vercel (gratis hasta cierto tráfico)
- **Backend:** Railway (hobby plan o free tier)
- **DB:** Supabase PostgreSQL (free tier: 500MB)
- **Cache:** Upstash Redis (free tier)
- **Foco:** conseguir primeros clientes, validar producto

### Fase 2: Crecimiento (6–18 meses) | Costo ≈ $100–$300/mes

- **Backend:** Railway Pro o Fly.io (múltiples instancias)
- **DB:** Supabase Pro o Neon.tech (backups, más storage)
- **Cache:** Upstash Redis Pro
- **CDN:** Cloudflare (cacheo estático, imágenes)
- **Monitoring:** Sentry (errores), Better Uptime (alertas)

### Fase 3: Escala (18+ meses) | Costo variable

- **Migración a AWS:** ECS (backend), RDS PostgreSQL Multi-AZ, ElastiCache
- **Horizontal scaling:** múltiples instancias de backend detrás de un ALB
- **DB read replicas:** para queries de reportes pesados
- **Separación microservicios:** extraer módulo de sync y billing como servicios independientes si el equipo crece
- **Kubernetes:** si se requiere auto-scaling fino

---

## 17. Observabilidad y monitoreo

### Stack de observabilidad

| Herramienta    | Qué monitorea                           | Cuándo agregar      |
| -------------- | --------------------------------------- | ------------------- |
| Sentry         | Errores de runtime (backend + frontend) | Día 1 en producción |
| Pino (logger)  | Logs estructurados en JSON del backend  | Día 1               |
| Better Uptime  | Uptime y alertas de caída               | Día 1               |
| Prisma Metrics | Queries lentas, pool exhaustion         | Fase 2              |
| OpenTelemetry  | Trazas distribuidas (request lifecycle) | Fase 2              |
| Grafana + Loki | Dashboard de logs y métricas            | Fase 3              |

### Métricas clave a monitorear

- `sync.queue.depth` — cuántos eventos pendientes de sincronizar por tenant
- `sync.conflict.rate` — tasa de conflictos (señal de problemas de red o UX)
- `api.latency.p99` — latencia percentil 99 por endpoint
- `db.pool.waitingCount` — presión en el pool de conexiones PostgreSQL
- `tenant.device.usage` — uso de dispositivos vs límite del plan (para upsell)

---

## 18. Variables de entorno

```bash
# apps/backend/.env.example

# Base de datos
DATABASE_URL="postgresql://user:password@localhost:5432/pos_dev"
DATABASE_POOL_SIZE=10

# Redis
REDIS_URL="redis://localhost:6379"

# JWT (RS256 — generar con openssl)
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n..."
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_EXPIRY="30d"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Email
RESEND_API_KEY="re_..."
EMAIL_FROM="noreply@tuposaas.com"

# App
NODE_ENV="development"
PORT=3001
CORS_ORIGINS="http://localhost:3000,http://localhost:3002"
API_PREFIX="api/v1"

# Offline token
OFFLINE_TOKEN_MAX_DAYS=7
```

---

## 19. Flujo de desarrollo — comandos

```bash
# Clonar e instalar
git clone https://github.com/org/pos-saas
cd pos-saas
pnpm install

# Levantar servicios locales (postgres + redis)
docker compose -f docker/docker-compose.yml up -d

# Aplicar migraciones y seed
pnpm --filter backend prisma:migrate
pnpm --filter backend prisma:seed

# Desarrollo (todos los apps en paralelo)
pnpm dev

# Solo backend
pnpm --filter backend dev

# Solo POS web
pnpm --filter pos-web dev

# Tests
pnpm test                    # todos
pnpm --filter backend test   # solo backend
pnpm --filter backend test:e2e

# Build producción
pnpm build

# Generar cliente Prisma después de cambiar schema
pnpm --filter backend prisma:generate
```

---

## 20. Convenciones y mejores prácticas

### Git — branching model

```
main          ← producción, siempre deployable
develop       ← integración, base para features
feature/xxx   ← desarrollo de features
fix/xxx       ← bugs
release/x.x   ← preparación de release
```

### Commits — Conventional Commits

```
feat(sales): add partial payment support
fix(sync): handle duplicate offlineId gracefully
chore(deps): upgrade Prisma to 5.10
docs(api): add sync endpoint documentation
test(auth): add refresh token rotation tests
```

### Code review checklist

- [ ] ¿El endpoint nuevo valida el tenantId del JWT (no de la URL)?
- [ ] ¿Los queries a DB incluyen `tenantId` en el WHERE?
- [ ] ¿El DTO nuevo tiene validadores con class-validator?
- [ ] ¿El nuevo módulo tiene tests unitarios?
- [ ] ¿Los errores siguen el formato estándar `{ error: { code, message } }`?
- [ ] ¿El sync engine maneja el nuevo tipo de dato?

---

## 21. Roadmap de desarrollo

### Sprint 0 — Infraestructura base (Semana 1–2)

- [ ] Setup monorepo Turborepo + pnpm workspaces
- [ ] Docker Compose con postgres + redis
- [ ] NestJS con módulo auth básico
- [ ] Prisma schema completo + primera migración
- [ ] CI básico (lint + type-check)

### Sprint 1 — Auth + Tenants (Semana 3–4)

- [ ] Registro de tenant + usuario admin
- [ ] Login → JWT RS256 + refresh tokens
- [ ] RBAC guards
- [ ] RLS en PostgreSQL
- [ ] Tests de auth

### Sprint 2 — Inventario + POS Web básico (Semana 5–6)

- [ ] CRUD productos y categorías
- [ ] UI POS web: grid de productos + carrito
- [ ] Crear venta (online)
- [ ] Impresión de ticket (básico)

### Sprint 3 — Offline first (Semana 7–9)

- [ ] IndexedDB con Dexie.js
- [ ] Sync engine v1: push/pull básico
- [ ] Deduplicación por offlineId
- [ ] Offline banner + indicador de estado
- [ ] Tests del sync engine

### Sprint 4 — Billing + Planes (Semana 10–11)

- [ ] Integración Stripe
- [ ] Webhooks de pago
- [ ] Límites por plan (devices, usuarios)
- [ ] Portal de facturación

### Sprint 5 — Reportes + Notificaciones (Semana 12–13)

- [ ] Dashboard de ventas
- [ ] Exportación CSV
- [ ] Email de bienvenida + alertas stock

### Sprint 6 — Electron Desktop (Semana 14–15)

- [ ] Setup Electron con React
- [ ] SQLite local con SQLCipher
- [ ] Sync engine con SQLite
- [ ] Integración impresora térmica (WebUSB / ESC/POS)

---

## Conclusión

Esta estructura está diseñada para:

- **Iniciar barato:** $0 en Fase 1 con Vercel + Supabase + Railway
- **Crecer sin refactorizar:** los módulos, el schema y el sync engine están pensados para escala desde el inicio
- **Ser seguro por diseño:** RLS, JWT RS256, tokens offline firmados, cifrado local
- **Funcionar sin internet de verdad:** el sync engine es el corazón del sistema, no un feature secundario
- **Ser mantenible:** monorepo tipado, convenciones claras, tests en capas

El orden de implementación recomendado: Auth → Inventario → Ventas online → Sync offline → Billing → Reportes → Desktop.
