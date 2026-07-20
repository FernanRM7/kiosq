import { Injectable, Logger } from "@nestjs/common";
import { WorkOS } from "@workos-inc/node";
import type { JWTVerifyGetKey } from "jose";

import { loadAuthConfig } from "../config/auth.config";
import type { AuthConfig } from "../config/auth.config";
import { createWorkosJwks } from "../lib/jwks.lib";
import type { JwtPayload } from "../types/jwt-payload.type";
import { verifyWorkosToken } from "../utils/jwt.util";

/** Result of a successful code exchange */
export interface CodeExchangeResult {
  /** The WorkOS sealed session string — write this to the `wos-session` cookie */
  sealedSession: string;
  /** WorkOS user ID */
  userId: string;
  /** Organization the user authenticated into (present when using Organizations) */
  organizationId: string | undefined;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private cachedConfig: AuthConfig | null = null;
  private cachedJwks: JWTVerifyGetKey | null = null;
  private cachedWorkos: WorkOS | null = null;

  get clientId(): string {
    return this.config.clientId;
  }

  get cookiePassword(): string {
    return this.config.cookiePassword;
  }

  /** URI registered in the WorkOS dashboard (must match exactly) */
  get redirectUri(): string {
    return this.config.redirectUri;
  }

  /** Frontend base URL — used to build post-auth redirect targets */
  get appUrl(): string {
    return this.config.appUrl;
  }

  /** Lazily constructed WorkOS SDK client. */
  get workos(): WorkOS {
    if (!this.cachedWorkos) {
      const { config } = this;
      this.cachedWorkos = new WorkOS(config.apiKey, {
        clientId: config.clientId,
      });
    }

    return this.cachedWorkos;
  }

  /**
   * Exchanges an OAuth2 authorization code for a sealed WorkOS session.
   *
   * Uses `sealSession: true` so WorkOS returns an encrypted session string
   * ready to be stored in an HttpOnly cookie — no access/refresh tokens
   * are exposed to the browser at any point.
   *
   * @param code - The `code` query parameter received from WorkOS
   * @throws {WorkOS API error} When the code is invalid, expired, or already used
   */
  async exchangeCodeForSession(code: string): Promise<CodeExchangeResult> {
    try {
      const { config } = this;

      const result = await this.workos.userManagement.authenticateWithCode({
        clientId: config.clientId,
        code,
        session: {
          cookiePassword: config.cookiePassword,
          sealSession: true,
        },
      });

      return {
        organizationId: result.organizationId ?? undefined,
        sealedSession: result.sealedSession ?? "",
        userId: result.user.id,
      };
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Failed to exchange WorkOS code"
      );
      throw error;
    }
  }

  /**
   * Verifies a WorkOS access token.
   * Delegates to the decoupled jwt.util helper for testability.
   *
   * @throws {Error} When the token is invalid, expired, or issuer mismatches
   */
  verifyToken(token: string): Promise<JwtPayload> {
    return verifyWorkosToken(token, this.jwks);
  }

  /**
   * Generates a WorkOS logout URL for the given session.
   *
   * Visiting this URL invalidates the WorkOS session server-side.
   * After invalidation, WorkOS redirects the user to the post-logout
   * URL configured in the WorkOS dashboard.
   *
   * @param sessionId - The `sessionId` from the authenticated session result
   */
  getLogoutUrl(sessionId: string): string {
    return this.workos.userManagement.getLogoutUrl({
      returnTo: this.config.appUrl,
      sessionId,
    });
  }

  /**
   * Generates a WorkOS AuthKit authorization URL.
   *
   * The client must redirect the user's browser to this URL to start
   * the authentication flow. WorkOS will redirect back to `WORKOS_REDIRECT_URI`
   * with a one-time `code` after the user authenticates.
   *
   * @param organizationId - When provided, targets SSO for a specific organization.
   *                         Required for organization-specific login flows.
   * @param state          - Opaque string echoed back in the callback query params.
   *                         Use for CSRF protection or to preserve client state.
   */
  getAuthorizationUrl(options?: {
    organizationId?: string;
    state?: string;
  }): string {
    const { config } = this;

    return this.workos.userManagement.getAuthorizationUrl({
      clientId: config.clientId,
      organizationId: options?.organizationId,
      provider: "authkit",
      redirectUri: config.redirectUri,
      state: options?.state,
    });
  }

  private get config(): AuthConfig {
    if (!this.cachedConfig) {
      this.cachedConfig = loadAuthConfig();
    }

    return this.cachedConfig;
  }

  private get jwks(): JWTVerifyGetKey {
    if (!this.cachedJwks) {
      this.cachedJwks = createWorkosJwks(this.config.clientId);
    }

    return this.cachedJwks;
  }
}
