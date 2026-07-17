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
  /**
   * URL to redirect the browser after WorkOS completes server-side logout.
   * MUST be registered as a Redirect URI in the WorkOS AuthKit dashboard.
   * Defaults to APP_URL if not set.
   *
   * IMPORTANT: If this URL is not registered in WorkOS, the logout will
   * redirect to a WorkOS error page ("Something went wrong").
   * Register it under AuthKit → Redirects → Redirect URIs.
   */
  logoutReturnTo: string;
}

export function loadAuthConfig(): AuthConfig {
  const apiKey = process.env.WORKOS_API_KEY;
  const clientId = process.env.WORKOS_CLIENT_ID;
  const cookiePassword = process.env.WORKOS_COOKIE_PASSWORD;
  const redirectUri = process.env.WORKOS_REDIRECT_URI;
  const appUrl = process.env.APP_URL ?? "http://localhost:5173";
  const logoutReturnTo =
    process.env.WORKOS_LOGOUT_RETURN_TO ?? appUrl;

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

  return {
    apiKey,
    appUrl,
    clientId,
    cookiePassword,
    logoutReturnTo,
    redirectUri,
  };
}
