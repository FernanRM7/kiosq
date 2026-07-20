import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import {
  ApiExcludeEndpoint,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Request } from "express";

import { Public } from "../decorators/public.decorator";
import { WorkosEventSchema } from "../schemas/workos-event.schema";
import { AuthService } from "../services/auth.service";
import { SyncService } from "../services/sync.service";

/**
 * Receives and processes WorkOS webhook events.
 *
 * ## Security
 * Every incoming request is verified using HMAC-SHA256 via the WorkOS SDK
 * before any processing occurs. Requests with invalid or missing signatures
 * are rejected with HTTP 400.
 *
 * ## Idempotency
 * WorkOS delivers webhooks at-least-once. The `SyncService` handles this
 * by using `upsert` keyed on WorkOS IDs — replaying an event is safe.
 *
 * ## Registration
 * The WorkOS dashboard must be configured to POST to:
 * `https://your-domain.com/webhooks/workos`
 *
 * The `WORKOS_WEBHOOK_SECRET` environment variable must match the signing
 * secret shown in the WorkOS dashboard for this endpoint.
 */
@Public()
@ApiTags("Webhooks")
@Controller("webhooks")
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly syncService: SyncService
  ) {}

  /**
   * WorkOS webhook receiver.
   *
   * Accepts `organization.created`, `organization.updated`,
   * `user.created`, and `user.updated` events.
   * Unknown event types are acknowledged (200) and ignored.
   */
  @Post("workos")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    description: `
WorkOS webhook endpoint.

Verifies the HMAC-SHA256 signature on every request using the
\`WORKOS_WEBHOOK_SECRET\` environment variable. Rejects unsigned requests with 400.

Processed events:
- \`organization.created\` → upsert Tenant
- \`organization.updated\` → upsert Tenant
- \`user.created\`         → upsert User identity
- \`user.updated\`         → upsert User identity

All operations are idempotent — safe for WorkOS at-least-once delivery.
    `.trim(),
    summary: "WorkOS webhook receiver",
  })
  @ApiResponse({
    description: "Event received and processed (or acknowledged and ignored).",
    schema: {
      properties: { received: { example: true, type: "boolean" } },
    },
    status: HttpStatus.OK,
  })
  @ApiResponse({
    description: "Invalid or missing webhook signature.",
    status: HttpStatus.BAD_REQUEST,
  })
  @ApiExcludeEndpoint(false)
  async handleWorkosWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers("workos-signature") signature: string | undefined
  ): Promise<{ received: boolean }> {
    // ── 1. Verify signature ────────────────────────────────────────────────
    if (!signature) {
      this.logger.warn("Webhook received without workos-signature header");
      throw new BadRequestException("Falta la cabecera de verificación");
    }

    const { rawBody } = request;

    if (!rawBody) {
      throw new BadRequestException("Error interno al verificar la solicitud");
    }

    const webhookSecret = this.getWebhookSecret();

    if (!webhookSecret) {
      this.logger.error(
        "Missing required environment variable: WORKOS_WEBHOOK_SECRET"
      );
      throw new ServiceUnavailableException(
        "Webhook de WorkOS no configurado en este entorno"
      );
    }

    let payload: unknown;

    try {
      // WorkOS SDK verifies the HMAC-SHA256 signature and returns the parsed event
      payload = this.authService.workos.webhooks.constructEvent({
        payload: rawBody,
        secret: webhookSecret,
        sigHeader: signature,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Signature verification failed";
      this.logger.error(
        { err: error },
        `Webhook signature verification failed: ${message}`
      );
      throw new BadRequestException("Firma de webhook inválida");
    }

    // ── 2. Log event reception ─────────────────────────────────────────────
    const rawEventType =
      (payload as Record<string, unknown>)?.event ?? "unknown";
    this.logger.log(`WorkOS webhook received: ${String(rawEventType)}`);

    // ── 3. Validate and dispatch known events ──────────────────────────────
    const parsed = WorkosEventSchema.safeParse(payload);

    if (!parsed.success) {
      // Unknown event type — acknowledge without processing (forward-compatible)
      const rawEvent = (payload as Record<string, unknown>)?.event ?? "unknown";
      this.logger.debug(`Ignoring unknown WorkOS event: ${String(rawEvent)}`);
      return { received: true };
    }

    try {
      this.logger.log(
        `Processing WorkOS event: type=${parsed.data.event}, id=${parsed.data.id}`
      );
      await this.syncService.handleEvent(parsed.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      this.logger.error(`Failed to process WorkOS event: ${message}`, error);
      throw new UnprocessableEntityException(
        "Error al procesar el evento. Se reintentará automáticamente."
      );
    }

    this.logger.log(
      `WorkOS event processed: ${parsed.data.event} [${parsed.data.id}]`
    );

    return { received: true };
  }

  private getWebhookSecret(): string | null {
    return process.env.WORKOS_WEBHOOK_SECRET ?? null;
  }
}
