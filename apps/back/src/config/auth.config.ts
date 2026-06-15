/**
 * Configuration for the OAuth2 callback flow.
 *
 * Loaded once at AuthService construction time and validated eagerly
 * so the application fails fast on startup rather than at request time.
 */
export interface AuthConfig {
  apiKey: string;
  clientId: string;
  cookiePassword: string;
  /** URI registered in the WorkOS dashboard — must match exactly */
  redirectUri: string;
  /**
   * Frontend origin to redirect to after a successful or failed auth.
   * Example: http://localhost:5173
   */
  appUrl: string;
}

export function loadAuthConfig(): AuthConfig {
  const apiKey = process.env.WORKOS_API_KEY;
  const clientId = process.env.WORKOS_CLIENT_ID;
  const cookiePassword = process.env.WORKOS_COOKIE_PASSWORD;
  const redirectUri = process.env.WORKOS_REDIRECT_URI;
  const appUrl = process.env.APP_URL ?? "http://localhost:5173";

  if (!apiKey) {
    throw new Error("Missing required environment variable: WORKOS_API_KEY");
  }

  if (!clientId) {
    throw new Error("Missing required environment variable: WORKOS_CLIENT_ID");
  }

  if (!cookiePassword) {
    throw new Error(
      "Missing required environment variable: WORKOS_COOKIE_PASSWORD"
    );
  }

  if (cookiePassword.length < 32) {
    throw new Error(
      "WORKOS_COOKIE_PASSWORD must be at least 32 characters long"
    );
  }

  if (!redirectUri) {
    throw new Error(
      "Missing required environment variable: WORKOS_REDIRECT_URI"
    );
  }

  return { apiKey, appUrl, clientId, cookiePassword, redirectUri };
}
