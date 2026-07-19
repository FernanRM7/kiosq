import { Injectable, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import { decodeJwt } from "jose";

import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from "../constants/cookie.constants";
import { cid } from "../lib/request-context";
import type { SessionResult } from "../types/session.type";
import { AuthService } from "./auth.service";
import { SessionRegistryService } from "./session-registry.service";
import type { SessionMetadata } from "./session-registry.service";

/**
 * Proactive refresh triggers when the JWT remaining lifetime is below
 * this many seconds. 5 minutes gives enough runway to obtain a new token
 * before the current one expires without refreshing on every request.
 *
 * A 1-hour threshold (the previous value) caused the backend to call WorkOS
 * on every single request because a freshly-issued JWT always has ~3 600 s
 * remaining, which is below 3 600 — triggering a concurrent-request race
 * condition that produced HTTP 500/502 errors on /api/me.
 */
const PROACTIVE_REFRESH_SECONDS = 5 * 60; // 5 minutes

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
    const sealedSession = request.cookies?.[SESSION_COOKIE_NAME] as
      | string
      | undefined;

    if (!sealedSession) {
      this.logger.debug(
        `${cid()} Session authentication failed: no_session_cookie_provided`
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
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `${cid()} Session load/authenticate failed: ${errMsg}`,
        error instanceof Error ? error.stack : undefined
      );
      return { authenticated: false, reason: "session_load_failed" };
    }

    if (result.authenticated) {
      const sessionId = String(result.sessionId ?? "");
      const userId = result.user.id;

      // Redis revocation check: verify the session is still active in Redis.
      // Redis acts as a cache — the WorkOS sealed cookie is the authoritative
      // source of truth. When a session is absent from Redis, auto-recover by
      // re-registering it rather than rejecting the request. This avoids false
      // 401s caused by:
      //   - Redis being temporarily unavailable during callback registration
      //   - Redis flush/deployment clearing cached sessions
      //   - Clock skew causing premature Redis TTL expiry
      if (sessionId) {
        try {
          const isActive = await this.sessionRegistry.isSessionActive(
            userId,
            sessionId
          );

          if (isActive) {
            try {
              await this.sessionRegistry.touchSession(userId, sessionId);
            } catch {
              /* non-critical: heartbeat failure does not invalidate session */
            }
          } else {
            this.logger.debug(
              `${cid()} Session absent from Redis for userId=${userId} sessionId=${sessionId} — auto-recovering registration`
            );
            try {
              await this.registerSession(
                userId,
                sessionId,
                result.user,
                request
              );
            } catch {
              /* non-critical: registration recovery failure does not invalidate session */
            }
          }
        } catch {
          this.logger.warn(
            `${cid()} Redis unavailable during session check: sessionId=${sessionId} userId=${userId} — allowing request through (fail-open)`
          );
        }
      }

      this.logger.debug(
        `${cid()} Session authenticated: userId=${userId} sessionId=${sessionId}`
      );

      const authenticatedResult: SessionResult = {
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

      // Proactive refresh: when the JWT is close to expiring, call session.refresh()
      // to reset the WorkOS inactivity timer. This prevents sessions from being
      // killed due to inactivity while the user is actively using the app.
      if (sessionId && this.shouldProactivelyRefresh(result.accessToken)) {
        const remaining = this.getJwtRemainingSeconds(result.accessToken);
        this.logger.debug(
          `${cid()} JWT near expiry (${remaining}s remaining) — proactively refreshing session: userId=${userId} sessionId=${sessionId}`
        );

        try {
          const refreshed = await this.refreshSession(session, response);

          if (refreshed.authenticated) {
            return refreshed;
          }
        } catch {
          this.logger.warn(
            `${cid()} Proactive refresh failed for userId=${userId} — continuing with current session`
          );
        }
      }

      return authenticatedResult;
    }

    // Automatic refresh when the JWT is expired.
    // WorkOS rotates the refresh token internally — no manual /rotate_token needed.
    if (result.reason === "invalid_jwt") {
      this.logger.debug(
        `${cid()} JWT expired — attempting automatic session refresh via WorkOS`
      );

      return this.refreshSession(session, response);
    }

    this.logger.debug(
      `${cid()} Session authentication failed: reason=${result.reason} (from WorkOS)`
    );

    return { authenticated: false, reason: result.reason };
  }

  /**
   * Clears the session cookie from the response.
   * Call this on logout before redirecting to the WorkOS logout URL.
   *
   * Must pass the same `sameSite` and `secure` options as the original
   * cookie, otherwise browsers (especially with sameSite=none) will
   * ignore the clear command.
   */
  clearSession(response: Response): void {
    response.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: SESSION_COOKIE_OPTIONS.httpOnly,
      path: SESSION_COOKIE_OPTIONS.path,
      sameSite: SESSION_COOKIE_OPTIONS.sameSite,
      secure: SESSION_COOKIE_OPTIONS.secure,
    });
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

    try {
      await this.sessionRegistry.registerSession(metadata);
    } catch (error) {
      this.logger.error(
        {
          err: error instanceof Error ? error.message : String(error),
          sessionId,
          userId,
        },
        `${cid()} Failed to register session in Redis: sessionId=${sessionId}`
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
        {
          err: error instanceof Error ? error.message : String(error),
          sessionId,
          userId,
        },
        `${cid()} Failed to revoke session in Redis: sessionId=${sessionId}`
      );
    }
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
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `${cid()} Session refresh threw: ${errMsg}`,
        error instanceof Error ? error.stack : undefined
      );
      return { authenticated: false, reason: "session_refresh_failed" };
    }

    if (refreshResult.authenticated) {
      const sessionId = String(refreshResult.sessionId ?? "");
      const userId = refreshResult.user.id;

      // Verify session hasn't been explicitly revoked in Redis.
      // Absence (without a revocation marker) is treated as auto-recoverable.
      let isActive = true;
      try {
        isActive = await this.sessionRegistry.isSessionActive(
          userId,
          sessionId
        );
      } catch {
        this.logger.debug(
          `${cid()} Redis unavailable during refresh session check: sessionId=${sessionId} — allowing refresh through`
        );
      }

      if (!isActive && sessionId) {
        this.logger.debug(
          `${cid()} Refreshed session absent from Redis for userId=${userId} sessionId=${sessionId} — auto-recovering`
        );
        // The sealed session was refreshed successfully by WorkOS — re-register.
        // buildName helper inline to avoid compiling issues
        const name =
          [refreshResult.user.firstName, refreshResult.user.lastName]
            .filter(Boolean)
            .join(" ") ||
          refreshResult.user.email ||
          "User";
        try {
          await this.sessionRegistry.registerSession({
            createdAt: new Date().toISOString(),
            deviceInfo: "session_refresh",
            ipAddress: "0.0.0.0",
            lastActiveAt: new Date().toISOString(),
            sessionId,
            userEmail: refreshResult.user.email ?? "",
            userId,
            userName: name,
          });
        } catch {
          /* non-critical: re-registration failure during refresh does not invalidate session */
        }
      }

      // Persist the new sealed session — critical to avoid re-refresh on next request
      response.cookie(
        SESSION_COOKIE_NAME,
        refreshResult.sealedSession,
        SESSION_COOKIE_OPTIONS
      );

      this.logger.debug(
        `${cid()} Session refreshed for userId=${userId} sessionId=${sessionId} — new cookie written (sameSite=${SESSION_COOKIE_OPTIONS.sameSite} maxAge=${SESSION_COOKIE_OPTIONS.maxAge}s)`
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

    this.logger.warn(
      `${cid()} Session refresh failed: reason=${refreshResult.reason}`
    );

    return { authenticated: false, reason: refreshResult.reason };
  }

  /**
   * Decodes the JWT without verification and checks if it is close to expiry.
   *
   * Triggers when the remaining lifetime is under {@link PROACTIVE_REFRESH_SECONDS}
   * (5 minutes). Refreshing only near expiry avoids hammering WorkOS on every
   * request and eliminates the concurrent-refresh race condition.
   *
   * @param accessToken - Raw RS256 JWT from WorkOS
   */
  private shouldProactivelyRefresh(accessToken: string): boolean {
    try {
      const remaining = this.getJwtRemainingSeconds(accessToken);
      return remaining !== null && remaining < PROACTIVE_REFRESH_SECONDS;
    } catch {
      return false;
    }
  }

  private getJwtRemainingSeconds(accessToken: string): number | null {
    const payload = decodeJwt(accessToken);
    const now = Math.floor(Date.now() / 1000);
    const exp = payload.exp as number | undefined;
    if (!exp) {
      return null;
    }
    return exp - now;
  }
}
