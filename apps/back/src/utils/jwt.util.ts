import type { JWTVerifyGetKey } from "jose";

import type { JwtPayload } from "../types/jwt-payload.type";

export const WORKOS_ISSUER = "https://api.workos.com";
const RS256 = "RS256" as const;

/**
 * Verifies a WorkOS access token against the provided JWKS.
 *
 * Enforces:
 * - Algorithm: RS256 only (prevents algorithm confusion attacks)
 * - Issuer: must match WorkOS issuer (prevents cross-service token reuse)
 * - Expiration: validated by jose automatically
 *
 * Uses dynamic import() for jose because it's ESM-only and the package
 * runs in a CommonJS context (no "type": "module" in package.json).
 *
 * @throws {JWTExpired}   When the token has expired
 * @throws {JWTInvalid}   When the token is malformed or signature is invalid
 * @throws {JWTClaimValidationFailed} When issuer or algorithm mismatch
 */
export async function verifyWorkosToken(
  token: string,
  jwks: JWTVerifyGetKey
): Promise<JwtPayload> {
  const { jwtVerify } = await import("jose");
  const { payload } = await jwtVerify(token, jwks, {
    algorithms: [RS256],
    issuer: WORKOS_ISSUER,
  });

  return payload as unknown as JwtPayload;
}
