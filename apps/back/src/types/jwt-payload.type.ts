export interface JwtPayload {
  /** WorkOS user ID */
  sub: string;
  /** Session ID */
  sid: string;
  /** Organization ID (present when user belongs to an org) */
  org_id?: string;
  /** User role */
  role?: string;
  /** Token issuer */
  iss: string;
  /** Issued at (Unix timestamp) */
  iat: number;
  /** Expiration (Unix timestamp) */
  exp: number;
}
