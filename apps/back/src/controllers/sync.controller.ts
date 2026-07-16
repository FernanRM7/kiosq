import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../decorators/current-user.decorator";
import { SyncPullQueryDto } from "../schemas/sync-pull-query.dto";
import { SyncPullSuccessResponseSchema } from "../schemas/sync-pull-success-response.schema";
import { SyncPushSuccessResponseSchema } from "../schemas/sync-push-success-response.schema";
import { SyncPushDto } from "../schemas/sync-push.dto";
import { OfflineSyncService } from "../services/offline-sync.service";
import type { AuthenticatedSessionResult } from "../types/session.type";

/**
 * Sincronización offline-first para ventas.
 *
 * ## Push (`POST /api/sync/push`)
 * Recibe `{ events: [{ id: number, type: "CREATE_SALE", payload: { offlineId, createdAt, items, subtotal, taxAmount, total } }] }`.
 * Idempotente por `offlineId` — si ya existe una venta con ese `offlineId`, se omite pero se reporta el `id` como "applied".
 * Responde `{ success: true, data: { applied: number[], failed: [{ id, code, message }] } }`.
 *
 * ### Códigos de error en `failed[]`
 * | Código               | Significado                                     | Acción del cliente                 |
 * |----------------------|-------------------------------------------------|-------------------------------------|
 * | `BAD_REQUEST`        | Payload malformado o item inválido              | REJECTED (no reintentar)            |
 * | `FORBIDDEN`          | Usuario inactivo o sin sucursal asignada        | REJECTED (no reintentar)            |
 * | `INSUFFICIENT_STOCK` | Stock insuficiente (server-wins)                | CONFLICT (requiere reconciliación)  |
 * | `PRODUCT_NOT_FOUND`  | ProductBranch no existe en el catálogo          | REJECTED (no reintentar)            |
 * | `MISSING_OFFLINE_ID` | Payload sin `offlineId`                         | REJECTED (no reintentar)            |
 * | `UNKNOWN_EVENT_TYPE` | Tipo de evento no soportado                     | REJECTED (no reintentar)            |
 * | `INTERNAL_ERROR`     | Error transitorio del servidor                  | Retryable (reintentar con backoff)  |
 *
 * Los códigos `BAD_REQUEST`, `FORBIDDEN`, `INSUFFICIENT_STOCK`, `PRODUCT_NOT_FOUND`,
 * `MISSING_OFFLINE_ID`, y `UNKNOWN_EVENT_TYPE` producen un `SyncEvent` con estado
 * `REJECTED` (permanente) o `CONFLICT` (requiere intervención). `INTERNAL_ERROR`
 * es transitorio — el servidor **no** persiste el `SyncEvent` y el cliente debe
 * reintentar con backoff exponencial.
 *
 * ## Pull (`GET /api/sync/pull?since=ISO8601&cursor=id&limit=50`)
 * Devuelve ventas del tenant autenticado con paginación cursor.
 * - `since` (ISO 8601): filtra por `syncedAt >= since`.
 * - `cursor` (sale ID): página siguiente (del campo `nextCursor` de la respuesta).
 * - `limit` (1-200, default 50): items por página.
 * Responde `{ success: true, data: { sales, hasMore, nextCursor } }`.
 *
 * **Seguridad:** `tenantId`, `userId` y `branchId` se derivan de la sesión WorkOS autenticada.
 * El payload del cliente **nunca** sobrescribe estos valores (brecha mitigada).
 */
@ApiTags("Sync")
@Controller("api/sync")
export class SyncController {
  private readonly logger = new Logger(SyncController.name);

  constructor(private readonly offlineSync: OfflineSyncService) {}

  @Post("push")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    description:
      "Recibe eventos offline del cliente (ej. CREATE_SALE) y los aplica de forma idempotente. " +
      "Los IDs de tenant y usuario se derivan de la sesión autenticada, no del body. " +
      "La idempotencia se garantiza por `offlineId` en el payload.",
    summary: "Push de eventos offline al servidor",
  })
  @ApiResponse({
    description: "Eventos procesados correctamente",
    status: HttpStatus.OK,
    type: SyncPushSuccessResponseSchema,
  })
  async push(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Body() body: SyncPushDto
  ) {
    const result = await this.offlineSync.processEvents(body.events, session);
    return { data: result, success: true };
  }

  @Get("pull")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    description:
      "Devuelve ventas sincronizadas para el tenant autenticado con paginación cursor. " +
      "Acepta since (ISO 8601), cursor (sale ID), limit (1-200, default 50). " +
      "El tenantId se deriva de la sesión, no del query.",
    summary: "Pull de cambios desde el servidor",
  })
  @ApiResponse({
    description: "Cambios obtenidos correctamente",
    status: HttpStatus.OK,
    type: SyncPullSuccessResponseSchema,
  })
  async pull(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Query() query: SyncPullQueryDto
  ) {
    const data = await this.offlineSync.getChangesSince(
      {
        since: query.since,
        cursor: query.cursor,
        limit: query.limit,
      },
      session
    );
    return { data, success: true };
  }
}
