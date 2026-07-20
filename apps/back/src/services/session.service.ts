import { Injectable, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import { decodeJwt } from "jose";

import {
  CASHIER_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from "../constants/cookie.constants";
import { PrismaService } from "../lib/prisma.service";
import type { SessionResult } from "../types/session.type";
import { AuthService } from "./auth.service";
import { SessionRegistryService } from "./session-registry.service";
import type { SessionMetadata } from "./session-registry.service";

/**
 * Proactive refresh triggers when the JWT remaining lifetime is below
 * this many seconds. Set to 1 hour to ensure the WorkOS inactivity timer
 * (typically ≤ 1 hour) gets reset before the session is killed.
 */
const PROACTIVE_REFRESH_SECONDS = 60 * 60;

interface WorkosAuthenticatedResult {
  accessToken: string;
  authenticated: true;
  organizationId?: string | null;
  role?: string | null;
  sessionId?: string | null;
  user: {
    email?: string | null;
    emailVerified?: boolean;
    firstName?: string | null;
    id: string;
    lastName?: string | null;
  };
}

interface WorkosUnauthenticatedResult {
  authenticated: false;
  reason: string;
}

type WorkosSessionResult =
  | WorkosAuthenticatedResult
  | WorkosUnauthenticatedResult;

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly sessionRegistry: SessionRegistryService
  ) {}

  /**
   * Authenticates the sealed session from the request cookie.
   *
   * Flow:
   * 1. Read the `wos-session` cookie.
   * 2. Call `session.authenticate()` to validate the current access token.
   * 3. If authenticated, verify the session is still active in Redis:
   *    - Active (`isActive === true`): touch heartbeat and proceed.
   *    - Revoked (`isActive === false`): reject with `session_revoked`.
   *    - Redis unavailable (throws): fail-open — WorkOS cookie is the primary
   *      auth mechanism; locking out all users during a Redis outage is worse
   *      than the brief window where a revoked session might slip through.
   * 4. If the JWT is expired (`reason === 'invalid_jwt'`), automatically
   *    call `session.refresh()` — WorkOS handles token rotation internally.
   * 5. If refreshed, persist the new sealed session in the response cookie.
   *
   * @returns {SessionResult} Discriminated union with authenticated payload or failure reason.
   */
  async authenticateSession(
    request: Request,
    response: Response
  ): Promise<SessionResult> {
    const cashierSession = request.cookies?.[CASHIER_SESSION_COOKIE_NAME] as
      | string
      | undefined;

    if (cashierSession) {
      const authenticatedCashier = await this.authenticateCashierSession(
        cashierSession,
        request
      );

      if (authenticatedCashier.authenticated) {
        return authenticatedCashier;
      }
    }

    return this.authenticateWorkosSession(request, response);
  }

  /**
   * Clears the session cookie from the response.
   * Call this on logout before redirecting to the WorkOS logout URL.
   */
  clearSession(response: Response): void {
    response.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    this.logger.debug("Session cookie cleared");
  }

  /**
   * Clears the cashier session cookie from the response.
   */
  clearCashierSession(response: Response): void {
    response.clearCookie(CASHIER_SESSION_COOKIE_NAME, { path: "/" });
    this.logger.debug("Cashier session cookie cleared");
  }

  /**
   * Registers a session in Redis after a successful login.
   */
  async registerSession(
    userId: string,
    sessionId: string,
    user: {
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
      name?: string | null;
    },
    request: Request
  ): Promise<void> {
    const derivedName = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ");
    const name = user.name ?? (derivedName || "Usuario");
    const deviceInfo = request.headers["user-agent"] ?? "Unknown";
    const ipAddress =
      (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      request.ip ??
      "Unknown";

    const metadata: SessionMetadata = {
      createdAt: new Date().toISOString(),
      deviceInfo,
      ipAddress,
      lastActiveAt: new Date().toISOString(),
      sessionId,
      userEmail: user.email ?? "",
      userId,
      userName: name,
    };

    try {
      await this.sessionRegistry.registerSession(metadata);
    } catch (error) {
      this.logger.error(
        { err: error, sessionId, userId },
        "Failed to register session in Redis"
      );
    }
  }

  /**
   * Revokes a specific session (removes from Redis).
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    try {
      await this.sessionRegistry.removeSession(userId, sessionId);
    } catch (error) {
      this.logger.error(
        { err: error, sessionId, userId },
        "Failed to revoke session in Redis"
      );
    }
  }

  /**
   * Serializes a cashier session into an opaque cookie payload.
   */
  createCashierSessionCookieValue(userId: string, sessionId: string): string {
    return Buffer.from(JSON.stringify({ sessionId, userId })).toString(
      "base64url"
    );
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async authenticateWorkosSession(
    request: Request,
    response: Response
  ): Promise<SessionResult> {
    const sealedSession = request.cookies?.[SESSION_COOKIE_NAME] as
      | string
      | undefined;

    if (!sealedSession) {
      this.logger.warn(
        "Session authentication failed: no_session_cookie_provided"
      );
      return { authenticated: false, reason: "no_session_cookie_provided" };
    }

    let session;
    let result: WorkosSessionResult;
    try {
      session = this.authService.workos.userManagement.loadSealedSession({
        cookiePassword: this.authService.cookiePassword,
        sessionData: sealedSession,
      });
      result = (await session.authenticate()) as WorkosSessionResult;
    } catch (error) {
      this.logger.error(`Session load/authenticate failed: ${error}`);
      return { authenticated: false, reason: "session_load_failed" };
    }

    if (result.authenticated) {
      return this.handleAuthenticatedWorkosSession(session, result, response);
    }

    // Automatic refresh when the JWT is expired.
    // WorkOS rotates the refresh token internally — no manual /rotate_token needed.
    if (result.reason === "invalid_jwt") {
      this.logger.debug(
        "JWT expired — attempting automatic session refresh via WorkOS"
      );

      return this.refreshSession(session, response);
    }

    this.logger.warn(`Session authentication failed: ${result.reason}`);

    return { authenticated: false, reason: result.reason };
  }

  private async authenticateCashierSession(
    cashierSessionCookie: string,
    request: Request
  ): Promise<SessionResult> {
    const payload = this.parseCashierSessionCookie(cashierSessionCookie);

    if (!payload) {
      return { authenticated: false, reason: "cashier_session_invalid" };
    }

    const user = await this.prisma.user.findUnique({
      select: {
        email: true,
        id: true,
        isActive: true,
        name: true,
        role: true,
        tenantId: true,
      },
      where: { id: payload.userId },
    });

    if (!user || !user.isActive || user.role !== "CASHIER") {
      return { authenticated: false, reason: "cashier_session_invalid" };
    }

    const isActive = await this.sessionRegistry.isSessionActive(
      user.id,
      payload.sessionId
    );

    if (!isActive) {
      return { authenticated: false, reason: "session_revoked" };
    }

    await this.sessionRegistry.touchSession(user.id, payload.sessionId);

    const deviceInfo = request.headers["user-agent"] ?? "Unknown";
    this.logger.debug(
      `Cashier session authenticated for user ${user.id} on ${deviceInfo}`
    );

    return {
      accessToken: "",
      authType: "cashier",
      authenticated: true,
      dbUserId: user.id,
      organizationId: undefined,
      role: user.role,
      sessionId: payload.sessionId,
      tenantId: user.tenantId,
      user: {
        email: user.email,
        emailVerified: false,
        firstName: null,
        id: user.id,
        lastName: null,
        name: user.name,
      },
      userId: user.id,
    };
  }

  private async handleAuthenticatedWorkosSession(
    session: ReturnType<
      typeof this.authService.workos.userManagement.loadSealedSession
    >,
    result: WorkosAuthenticatedResult,
    response: Response
  ): Promise<SessionResult> {
    const sessionId = String(result.sessionId ?? "");
    const userId = result.user.id;

    // Strict revocation check: if the session is absent from Redis it was
    // explicitly revoked. Only a genuine Redis error (throw) is treated as
    // non-critical (fail-open) — a clean false return means revoked.
    if (sessionId) {
      try {
        const isActive = await this.sessionRegistry.isSessionActive(
          userId,
          sessionId
        );

        if (!isActive) {
          this.logger.warn(
            `Session ${sessionId} is not active in Redis — rejecting (session_revoked)`
          );
          return { authenticated: false, reason: "session_revoked" };
        }

        // Session is active — update the heartbeat timestamp (non-critical)
        await this.sessionRegistry.touchSession(userId, sessionId).catch(() => {
          // Non-critical: a failed heartbeat does not invalidate the session
        });
      } catch {
        // Redis is unavailable — fail-open. WorkOS sealed session is the
        // primary auth mechanism; we cannot revoke sessions while Redis is down,
        // but we should not lock out all users either.
        this.logger.warn(
          `Redis unavailable during session check for ${sessionId} — allowing request through`
        );
      }
    }

    this.logger.debug(`Session authenticated for user ${userId}`);

    const localUser = await this.resolveLocalUserByWorkosUserId(userId);
    const authenticatedResult: SessionResult = {
      accessToken: result.accessToken,
      authType: "workos",
      authenticated: true,
      dbUserId: localUser?.id,
      organizationId: result.organizationId
        ? String(result.organizationId)
        : undefined,
      role: result.role ? String(result.role) : undefined,
      sessionId,
      tenantId: localUser?.tenantId,
      user: {
        ...result.user,
        email: result.user.email ?? null,
        emailVerified: Boolean(result.user.emailVerified),
        firstName: result.user.firstName ?? null,
        lastName: result.user.lastName ?? null,
        name: this.buildDisplayName({
          email: result.user.email ?? null,
          firstName: result.user.firstName ?? null,
          lastName: result.user.lastName ?? null,
        }),
      },
      userId,
    };

    // Proactive refresh: when the JWT is close to expiring, call session.refresh()
    // to reset the WorkOS inactivity timer. This prevents sessions from being
    // killed due to inactivity while the user is actively using the app.
    if (sessionId && this.shouldProactivelyRefresh(result.accessToken)) {
      this.logger.debug("JWT near expiry — proactively refreshing session");

      try {
        const refreshed = await this.refreshSession(session, response);

        if (refreshed.authenticated) {
          return refreshed;
        }
      } catch {
        this.logger.warn(
          "Proactive refresh failed — continuing with current session"
        );
      }
    }

    return authenticatedResult;
  }

  private parseCashierSessionCookie(
    cookieValue: string
  ): { sessionId: string; userId: string } | null {
    try {
      const parsed = JSON.parse(
        Buffer.from(cookieValue, "base64url").toString("utf-8")
      ) as {
        sessionId?: string;
        userId?: string;
      };

      if (!parsed.sessionId || !parsed.userId) {
        return null;
      }

      return {
        sessionId: parsed.sessionId,
        userId: parsed.userId,
      };
    } catch {
      return null;
    }
  }

  private resolveLocalUserByWorkosUserId(
    workosUserId: string
  ): Promise<{ id: string; tenantId: string } | null> {
    return this.prisma.user.findUnique({
      select: {
        id: true,
        tenantId: true,
      },
      where: { workosUserId },
    });
  }

  private buildDisplayName(input: {
    email: string | null;
    firstName: string | null;
    lastName: string | null;
  }): string {
    return (
      [input.firstName, input.lastName].filter(Boolean).join(" ") ||
      input.email ||
      "Usuario"
    );
  }

  /**
   * Calls session.refresh() and persists the new sealed session cookie.
   * WorkOS automatically rotates the refresh token — this method only
   * writes the new sealedSession back to the cookie so the browser has it.
   */
  private async refreshSession(
    session: ReturnType<
      typeof this.authService.workos.userManagement.loadSealedSession
    >,
    response: Response
  ): Promise<SessionResult> {
    let refreshResult;
    try {
      refreshResult = await session.refresh();
    } catch (error) {
      this.logger.error(`Session refresh threw: ${error}`);
      return { authenticated: false, reason: "session_refresh_failed" };
    }

    if (refreshResult.authenticated) {
      const sessionId = String(refreshResult.sessionId ?? "");
      const userId = refreshResult.user.id;

      // Check if this session has been revoked — wrap in try/catch so a Redis
      // outage during refresh does not kill the entire refresh flow.
      let isActive = true;
      try {
        isActive = await this.sessionRegistry.isSessionActive(
          userId,
          sessionId
        );
      } catch {
        // Redis unavailable — fail-open for the same reason as authenticateSession
        this.logger.warn(
          `Redis unavailable during refresh session check for ${sessionId} — allowing refresh through`
        );
      }

      if (!isActive && sessionId) {
        this.logger.warn(`Refreshed session ${sessionId} has been revoked`);
        return { authenticated: false, reason: "session_revoked" };
      }

      // Persist the new sealed session — critical to avoid re-refresh on next request
      response.cookie(
        SESSION_COOKIE_NAME,
        refreshResult.sealedSession,
        SESSION_COOKIE_OPTIONS
      );

      this.logger.debug(
        `Session refreshed for user ${userId}. New cookie written.`
      );

      const localUser = await this.resolveLocalUserByWorkosUserId(userId);

      return {
        accessToken: refreshResult.session?.accessToken ?? "",
        authType: "workos",
        authenticated: true,
        dbUserId: localUser?.id,
        organizationId: refreshResult.organizationId
          ? String(refreshResult.organizationId)
          : undefined,
        role: refreshResult.role ? String(refreshResult.role) : undefined,
        sessionId,
        tenantId: localUser?.tenantId,
        user: {
          ...refreshResult.user,
          email: refreshResult.user.email ?? null,
          emailVerified: Boolean(refreshResult.user.emailVerified),
          firstName: refreshResult.user.firstName ?? null,
          lastName: refreshResult.user.lastName ?? null,
          name: this.buildDisplayName({
            email: refreshResult.user.email ?? null,
            firstName: refreshResult.user.firstName ?? null,
            lastName: refreshResult.user.lastName ?? null,
          }),
        },
        userId,
      };
    }

    this.logger.warn(`Session refresh failed: ${refreshResult.reason}`);

    return { authenticated: false, reason: refreshResult.reason };
  }

  /**
   * Decodes the JWT without verification and checks if it is close to expiry.
   *
   * Triggers when the remaining lifetime is under {@link PROACTIVE_REFRESH_SECONDS}.
   * This ensures the WorkOS inactivity timer gets reset before the session is killed,
   * regardless of how aggressively it's configured in the WorkOS Dashboard.
   *
   * @param accessToken - Raw RS256 JWT from WorkOS
   */
  private shouldProactivelyRefresh(accessToken: string): boolean {
    try {
      const payload = decodeJwt(accessToken);
      const now = Math.floor(Date.now() / 1000);
      const exp = payload.exp as number | undefined;

      if (!exp) {
        return false;
      }

      return exp - now < PROACTIVE_REFRESH_SECONDS;
    } catch {
      return false;
    }
  }
}
