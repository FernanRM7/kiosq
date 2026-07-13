import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import {
  ApiExcludeEndpoint,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { createHash } from "node:crypto";
import type { Request } from "express";

import { loadWebhookConfig } from "../config/webhook.config";
import { Public } from "../decorators/public.decorator";
import { cid } from "../lib/request-context";
import { WorkosEventSchema } from "../schemas/workos-event.schema";
import { AuthService } from "../services/auth.service";
import { SyncService } from "../services/sync.service";

interface WebhookVerificationContext {
  sigHash: string;
  headerTs: string | null;
  parsedTs: number | null;
  skewMs: number | null;
  skewSec: number | null;
  rawBody: Buffer;
  serverTimestamp: number;
}

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
  private readonly webhookSecret: string;
  private readonly webhookToleranceMs: number;

  constructor(
    private readonly authService: AuthService,
    private readonly syncService: SyncService
  ) {
    const config = loadWebhookConfig();
    this.webhookSecret = config.secret;
    this.webhookToleranceMs = config.toleranceMs;
  }

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
    this.requireSignatureHeader(signature);

    const ctx = this.buildVerificationContext(request, signature);

    this.logVerificationContext(ctx);

    const payload = this.verifySignature(ctx, signature);
    await this.dispatchEvent(payload, ctx);

    return { received: true };
  }

  // ─── Private helpers ────────────────────────────────────────────────────

  private requireSignatureHeader(signature: string | undefined): asserts signature is string {
    if (!signature) {
      this.logger.warn(
        `${cid()} Webhook rejected: missing workos-signature header`
      );
      throw new BadRequestException("Falta la cabecera de verificación");
    }
  }

  private buildVerificationContext(
    request: RawBodyRequest<Request>,
    signature: string
  ): WebhookVerificationContext {
    const serverTimestamp = Date.now();
    const sigHash = this.hashString(signature);
    const { timestamp: headerTs } = this.parseWorkosSignatureHeader(signature);
    const parsedTs =
      headerTs === null ? null : Number.parseInt(headerTs, 10);
    const skewMs =
      parsedTs === null || Number.isNaN(parsedTs)
        ? null
        : serverTimestamp - parsedTs;
    const skewSec = skewMs === null ? null : Math.round(skewMs / 1000);
    const rawBody = this.resolveRawBody(request, sigHash, headerTs, serverTimestamp);

    return {
      headerTs,
      parsedTs,
      rawBody,
      serverTimestamp,
      sigHash,
      skewMs,
      skewSec,
    };
  }

  private resolveRawBody(
    request: RawBodyRequest<Request>,
    sigHash: string,
    headerTs: string | null,
    serverTimestamp: number
  ): Buffer {
    const { rawBody } = request;

    if (rawBody) {
      return rawBody;
    }

    const hasParsedBody = request.body && typeof request.body === "object";

    if (hasParsedBody) {
      this.logger.warn(
        `${cid()} rawBody unavailable — reconstructing from parsed req.body ` +
          `(HMAC MAY FAIL if JSON serialization differs from original bytes)`
      );
      return Buffer.from(JSON.stringify(request.body));
    }

    this.logger.error(
      `${cid()} Webhook rejected: rawBody unavailable (ensure rawBody:true in NestFactory) ` +
        `sigHash=${sigHash} headerTs=${String(headerTs)} serverTs=${serverTimestamp}`
    );
    throw new BadRequestException(
      "Error interno al verificar la solicitud"
    );
  }

  private logVerificationContext(ctx: WebhookVerificationContext): void {
    const bodyHash = this.hashPayload(ctx.rawBody);

    this.logger.debug(
      `${cid()} Webhook verification context: sigHash=${ctx.sigHash} ` +
        `headerTs=${String(ctx.headerTs)} serverTs=${ctx.serverTimestamp} ` +
        `skew=${ctx.skewSec === null ? "unknown" : `${ctx.skewSec}s`} ` +
        `rawBodyLen=${ctx.rawBody.length} bodyHash=${bodyHash} ` +
        `tolerance=${this.webhookToleranceMs}ms`
    );
  }

  private verifySignature(
    ctx: WebhookVerificationContext,
    signature: string
  ): unknown {
    const bodyHash = this.hashPayload(ctx.rawBody);

    try {
      const payload = this.authService.workos.webhooks.constructEvent({
        payload: ctx.rawBody,
        secret: this.webhookSecret,
        sigHeader: signature,
        tolerance: this.webhookToleranceMs,
      });
      this.logger.debug(
        `${cid()} Webhook signature verified (bodyHash=${bodyHash})`
      );
      return payload;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Signature verification failed";
      this.logger.error(
        {
          bodyHash,
          err: error instanceof Error ? error.message : String(error),
          headerTs: String(ctx.headerTs),
          rawBodyLen: ctx.rawBody.length,
          serverTs: ctx.serverTimestamp,
          sigHash: ctx.sigHash,
          skewMs: ctx.skewMs,
          toleranceMs: this.webhookToleranceMs,
        },
        `${cid()} Webhook signature verification failed: ${message}`
      );
      throw new BadRequestException("Firma de webhook inválida");
    }
  }

  private async dispatchEvent(
    payload: unknown,
    ctx: WebhookVerificationContext
  ): Promise<void> {
    const bodyHash = this.hashPayload(ctx.rawBody);
    const rawEventType =
      (payload as Record<string, unknown>)?.event ?? "unknown";
    const rawEventId = (payload as Record<string, unknown>)?.id;

    this.logger.log(
      `${cid()} WorkOS webhook received: event=${String(rawEventType)} id=${String(rawEventId ?? "unknown")} bodyHash=${bodyHash}`
    );

    const parsed = WorkosEventSchema.safeParse(payload);

    if (!parsed.success) {
      const rawEvent = (payload as Record<string, unknown>)?.event ?? "unknown";
      this.logger.debug(
        `${cid()} Ignoring unknown/unparseable WorkOS event: ${String(rawEvent)} (schema mismatch)`
      );
      return;
    }

    try {
      this.logger.log(
        `${cid()} Dispatching WorkOS event: type=${parsed.data.event} id=${parsed.data.id}`
      );
      await this.syncService.handleEvent(parsed.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      this.logger.error(
        `${cid()} Failed to process WorkOS event: type=${parsed.data.event} id=${parsed.data.id} — ${message}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new UnprocessableEntityException(
        "Error al procesar el evento. Se reintentará automáticamente."
      );
    }

    this.logger.log(
      `${cid()} WorkOS event processed successfully: type=${parsed.data.event} id=${parsed.data.id}`
    );
  }

  /**
   * Extracts the timestamp and signature hash from a WorkOS webhook header.
   *
   * Format: `t=<unix_timestamp>, v1=<hex_signature>`
   *
   * The WorkOS SDK uses `sigHeader.split(",")[0].split("=")[1]`.
   * This mirrors that extraction for diagnostic logging purposes.
   */
  private parseWorkosSignatureHeader(
    sigHeader: string
  ): { schemeHash: string | null; timestamp: string | null } {
    const [tPart, v1Part] = sigHeader.split(",");

    if (tPart === undefined || v1Part === undefined) {
      return { schemeHash: null, timestamp: null };
    }

    const timestamp = tPart.split("=")[1] ?? null;
    const schemeHash = v1Part.split("=")[1]?.trim() ?? null;

    return { schemeHash, timestamp };
  }

  /**
   * Returns a truncated SHA-256 hash of a string for log traceability
   * without exposing the full value (e.g., signature header contents).
   */
  private hashString(input: string): string {
    return createHash("sha256").update(input).digest("hex").slice(0, 12);
  }

  /**
   * Returns a truncated SHA-256 hash of the raw body for log traceability
   * without exposing the full payload content.
   */
  private hashPayload(rawBody: Buffer): string {
    return createHash("sha256").update(rawBody).digest("hex").slice(0, 16);
  }
}
