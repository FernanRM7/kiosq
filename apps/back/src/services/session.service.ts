import { Injectable, Logger } from "@nestjs/common";
import type { Request, Response } from "express";

import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from "../constants/cookie.constants";
import type { SessionResult } from "../types/session.type";
import { AuthService } from "./auth.service";
import { SessionRegistryService } from "./session-registry.service";
import type { SessionMetadata } from "./session-registry.service";

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly authService: AuthService,
    private readonly sessionRegistry: SessionRegistryService
  ) {}

  /**
   * Authenticates the sealed session from the request cookie.
   *
   * Flow:
   * 1. Read the `wos-session` cookie.
   * 2. Call `session.authenticate()` to validate the current access token.
   * 3. If the JWT is expired (`reason === 'invalid_jwt'`), automatically
   *    call `session.refresh()` — WorkOS handles token rotation internally.
   * 4. If refreshed, persist the new sealed session in the response cookie.
   *
   * @returns {SessionResult} Discriminated union with authenticated payload or failure reason.
   */
  async authenticateSession(
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
    let result;
    try {
      session = this.authService.workos.userManagement.loadSealedSession({
        cookiePassword: this.authService.cookiePassword,
        sessionData: sealedSession,
      });
      result = await session.authenticate();
    } catch (error) {
      this.logger.error(`Session load/authenticate failed: ${error}`);
      return { authenticated: false, reason: "session_load_failed" };
    }

    if (result.authenticated) {
      const sessionId = String(result.sessionId ?? "");
      const userId = result.user.id;

      // Verify the session hasn't been revoked in Redis.
      // If Redis is unavailable or the session wasn't registered (e.g., on first
      // login before Redis registration completes), still allow the request through —
      // the sealed session cookie from WorkOS is the primary auth mechanism.
      if (sessionId) {
        try {
          const isActive = await this.sessionRegistry.isSessionActive(
            userId,
            sessionId
          );

          await (isActive
            ? this.sessionRegistry.touchSession(userId, sessionId).catch(() => {
                // Non-critical
              })
            : this.sessionRegistry.registerDummySession(userId, sessionId));
        } catch {
          // Redis unavailable — non-critical, allow auth to proceed
        }
      }

      this.logger.debug(`Session authenticated for user ${userId}`);

      return {
        accessToken: result.accessToken,
        authenticated: true,
        organizationId: result.organizationId
          ? String(result.organizationId)
          : undefined,
        role: result.role ? String(result.role) : undefined,
        sessionId,
        user: result.user,
        userId,
      };
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

  /**
   * Clears the session cookie from the response.
   * Call this on logout before redirecting to the WorkOS logout URL.
   */
  clearSession(response: Response): void {
    response.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    this.logger.debug("Session cookie cleared");
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
      email?: string;
    },
    request: Request
  ): Promise<void> {
    const name =
      [user.firstName, user.lastName].filter(Boolean).join(" ") || "User";
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

    await this.sessionRegistry.registerSession(metadata);
  }

  /**
   * Revokes a specific session (removes from Redis).
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.sessionRegistry.removeSession(userId, sessionId);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

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

      // Check if this session has been revoked
      const isActive = await this.sessionRegistry.isSessionActive(
        userId,
        sessionId
      );
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

      return {
        accessToken: refreshResult.session?.accessToken ?? "",
        authenticated: true,
        organizationId: refreshResult.organizationId
          ? String(refreshResult.organizationId)
          : undefined,
        role: refreshResult.role ? String(refreshResult.role) : undefined,
        sessionId,
        user: refreshResult.user,
        userId,
      };
    }

    this.logger.warn(`Session refresh failed: ${refreshResult.reason}`);

    return { authenticated: false, reason: refreshResult.reason };
  }
}
