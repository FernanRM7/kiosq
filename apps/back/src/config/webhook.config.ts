/**
 * Configuration for WorkOS webhook verification.
 *
 * Loaded eagerly so the application fails fast on startup rather than
 * at request time when the first webhook arrives.
 */
export interface WebhookConfig {
  /** WorkOS webhook secret — used to verify HMAC-SHA256 signatures */
  secret: string;
}

export function loadWebhookConfig(): WebhookConfig {
  const secret = process.env.WORKOS_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error(
      "Missing required environment variable: WORKOS_WEBHOOK_SECRET"
    );
  }

  return { secret };
}
