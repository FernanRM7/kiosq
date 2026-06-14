import { Injectable, Logger } from "@nestjs/common";
import type { Request, Response } from "express";

import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from "../constants/cookie.constants";
import type { SessionResult } from "../types/session.type";
import { AuthService } from "./auth.service";

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(private readonly authService: AuthService) {}

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

    const session = this.authService.workos.userManagement.loadSealedSession({
      cookiePassword: this.authService.cookiePassword,
      sessionData: sealedSession ?? "",
    });

    const result = await session.authenticate();

    if (result.authenticated) {
      this.logger.debug(`Session authenticated for user ${result.user.id}`);

      return {
        accessToken: result.accessToken,
        authenticated: true,
        organizationId: result.organizationId
          ? String(result.organizationId)
          : undefined,
        role: result.role ? String(result.role) : undefined,
        sessionId: String(result.sessionId ?? ""),
        user: result.user,
        userId: result.user.id,
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
    const refreshResult = await session.refresh();

    if (refreshResult.authenticated) {
      // Persist the new sealed session — critical to avoid re-refresh on next request
      response.cookie(
        SESSION_COOKIE_NAME,
        refreshResult.sealedSession,
        SESSION_COOKIE_OPTIONS
      );

      this.logger.debug(
        `Session refreshed for user ${refreshResult.user.id}. New cookie written.`
      );

      return {
        accessToken: refreshResult.session?.accessToken ?? "",
        authenticated: true,
        organizationId: refreshResult.organizationId
          ? String(refreshResult.organizationId)
          : undefined,
        role: refreshResult.role ? String(refreshResult.role) : undefined,
        sessionId: String(refreshResult.sessionId ?? ""),
        user: refreshResult.user,
        userId: refreshResult.user.id,
      };
    }

    this.logger.warn(`Session refresh failed: ${refreshResult.reason}`);

    return { authenticated: false, reason: refreshResult.reason };
  }
}
