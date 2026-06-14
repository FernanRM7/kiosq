export interface AuthConfig {
  apiKey: string;
  clientId: string;
  cookiePassword: string;
}

export function loadAuthConfig(): AuthConfig {
  const apiKey = process.env.WORKOS_API_KEY;
  const clientId = process.env.WORKOS_CLIENT_ID;
  const cookiePassword = process.env.WORKOS_COOKIE_PASSWORD;

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

  return { apiKey, clientId, cookiePassword };
}
