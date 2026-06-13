import type { User } from "@workos-inc/node";

/** Successful session authentication result */
export interface AuthenticatedSessionResult {
  authenticated: true;
  userId: string;
  sessionId: string;
  organizationId: string | undefined;
  role: string | undefined;
  user: User;
  accessToken: string;
}

/** Failed session authentication result */
export interface UnauthenticatedSessionResult {
  authenticated: false;
  reason: string;
}

/**
 * Result of authenticateSession().
 * Discriminated by the `authenticated` boolean.
 */
export type SessionResult =
  | AuthenticatedSessionResult
  | UnauthenticatedSessionResult;
