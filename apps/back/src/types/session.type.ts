export interface SessionUser {
  email: string | null;
  emailVerified: boolean;
  firstName: string | null;
  id: string;
  lastName: string | null;
  name: string | null;
}

/** Successful session authentication result */
export interface AuthenticatedSessionResult {
  authenticated: true;
  authType: "workos" | "cashier";
  dbUserId?: string;
  tenantId?: string;
  userId: string;
  sessionId: string;
  organizationId: string | undefined;
  role: string | undefined;
  user: SessionUser;
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
