export interface SessionUser {
  email: string | null;
  emailVerified: boolean;
  externalId?: string | null;
  firstName: string | null;
  id: string;
  lastName: string | null;
  lastSignInAt?: Date | null;
  locale?: string | null;
  metadata?: unknown;
  name: string | null;
  object?: string;
  profilePictureUrl?: string | null;
  updatedAt?: Date | string;
  createdAt?: Date;
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
