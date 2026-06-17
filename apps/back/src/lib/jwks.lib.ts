import { JWTVerifyGetKey, createRemoteJWKSet } from "jose";

/** WorkOS JWKS endpoint for User Management tokens */
const WORKOS_JWKS_URL = (clientId: string) =>
  `https://api.workos.com/user_management/jwks/${clientId}`;

/**
 * Creates a cached JWKS key set for WorkOS token verification.
 * Keys are cached for 10 minutes to avoid fetching on every request.
 */
export function createWorkosJwks(clientId: string): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL(WORKOS_JWKS_URL(clientId)), {
    cacheMaxAge: 10 * 60 * 1000,
  });
}
