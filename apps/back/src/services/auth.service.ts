import { Injectable } from "@nestjs/common";
import { WorkOS } from "@workos-inc/node";

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
  readonly workos: WorkOS;
  private readonly config: AuthConfig;
  private readonly jwks: ReturnType<typeof createWorkosJwks>;

  constructor() {
    this.config = loadAuthConfig();
    this.workos = new WorkOS(this.config.apiKey);
    this.jwks = createWorkosJwks(this.config.clientId);
  }

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
    const result = await this.workos.userManagement.authenticateWithCode({
      clientId: this.config.clientId,
      code,
      session: {
        cookiePassword: this.config.cookiePassword,
        sealSession: true,
      },
    });

    return {
      organizationId: result.organizationId ?? undefined,
      sealedSession: result.sealedSession ?? "",
      userId: result.user.id,
    };
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
    return this.workos.userManagement.getLogoutUrl({ sessionId });
  }
}
