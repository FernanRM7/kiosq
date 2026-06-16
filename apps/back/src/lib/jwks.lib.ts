import type { JWTVerifyGetKey } from "jose";

/** WorkOS JWKS endpoint for User Management tokens */
const WORKOS_JWKS_URL = (clientId: string) =>
  `https://api.workos.com/user_management/jwks/${clientId}`;

/**
 * Creates a cached JWKS key set for WorkOS token verification.
 * Keys are cached for 10 minutes to avoid fetching on every request.
 *
 * Uses dynamic import() for jose because it's ESM-only and the package
 * runs in a CommonJS context (no "type": "module" in package.json).
 */
export async function createWorkosJwks(
  clientId: string
): Promise<JWTVerifyGetKey> {
  const { createRemoteJWKSet } = await import("jose");
  return createRemoteJWKSet(new URL(WORKOS_JWKS_URL(clientId)), {
    cacheMaxAge: 10 * 60 * 1000,
  });
}
