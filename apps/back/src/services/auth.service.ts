import { Injectable } from "@nestjs/common";
import { WorkOS } from "@workos-inc/node";

import { loadAuthConfig } from "../config/auth.config";
import type { AuthConfig } from "../config/auth.config";

@Injectable()
export class AuthService {
  readonly workos: WorkOS;
  private readonly config: AuthConfig;

  constructor() {
    this.config = loadAuthConfig();
    this.workos = new WorkOS(this.config.apiKey);
  }

  get clientId(): string {
    return this.config.clientId;
  }

  get cookiePassword(): string {
    return this.config.cookiePassword;
  }
}
