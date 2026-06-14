import { Injectable } from "@nestjs/common";
import { WorkOS } from "@workos-inc/node";

import { loadAuthConfig } from "../config/auth.config";
import type { AuthConfig } from "../config/auth.config";
import { createWorkosJwks } from "../lib/jwks.lib";
import type { JwtPayload } from "../types/jwt-payload.type";
import { verifyWorkosToken } from "../utils/jwt.util";

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

  /**
   * Verifies a WorkOS access token.
   * Delegates to the decoupled jwt.util helper for testability.
   *
   * @throws {Error} When the token is invalid, expired, or issuer mismatches
   */
  verifyToken(token: string): Promise<JwtPayload> {
    return verifyWorkosToken(token, this.jwks);
  }
}
