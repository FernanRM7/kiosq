/**
 * Configuration for WorkOS webhook verification.
 *
 * Loaded eagerly so the application fails fast on startup rather than
 * at request time when the first webhook arrives.
 */
export interface WebhookConfig {
  /** WorkOS webhook secret — used to verify HMAC-SHA256 signatures */
  secret: string;
  /**
   * Maximum allowed clock skew between WorkOS server timestamp and local time.
   * Defaults to 300000ms (5 minutes). Increase if running on serverless
   * platforms where cold-start clock drift exceeds the WorkOS SDK default of
   * 180000ms (3 minutes).
   */
  toleranceMs: number;
}

export function loadWebhookConfig(): WebhookConfig {
  const secret = process.env.WORKOS_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error(
      "Missing required environment variable: WORKOS_WEBHOOK_SECRET"
    );
  }

  const toleranceMs = process.env.WORKOS_WEBHOOK_TOLERANCE_MS
    ? Number.parseInt(process.env.WORKOS_WEBHOOK_TOLERANCE_MS, 10)
    : 300_000;

  if (Number.isNaN(toleranceMs) || toleranceMs < 0) {
    throw new Error(
      "WORKOS_WEBHOOK_TOLERANCE_MS must be a non-negative integer"
    );
  }

  return { secret, toleranceMs };
}
