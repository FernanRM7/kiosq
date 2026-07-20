import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request, Response } from "express";

import {
  CASHIER_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "../constants/cookie.constants";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { CashierSessionService } from "../services/cashier-session.service";
import { SessionService } from "../services/session.service";
import type { SessionResult } from "../types/session.type";

/**
 * Guards routes by dispatching between two authentication sources:
 *
 * 1. **`wos-session`** (WorkOS sealed session) — validated by `SessionService`.
 *    Tried first. Existing WorkOS users are unchanged.
 * 2. **`cashier-session`** (cashier session id) — validated by
 *    `CashierSessionService`. Tried only when the WorkOS cookie is absent
 *    or invalid. Real implementation in T5.
 *
 * Route-level `@Public()` bypasses both checks.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly cashierSessionService: CashierSessionService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // ── Public route check ──────────────────────────────────────────────────
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // ── 1. Try WorkOS session ───────────────────────────────────────────────
    const wosCookie = request.cookies?.[SESSION_COOKIE_NAME];

    if (wosCookie) {
      const result = await this.sessionService.authenticateSession(
        request,
        response
      );

      if (result.authenticated) {
        this.logger.debug(`WorkOS auth success: user=${result.userId}`);
        this.injectUser(request, result);
        return true;
      }
    }

    // ── 2. Try cashier session (fallback) ───────────────────────────────────
    const cashierCookie = request.cookies?.[CASHIER_SESSION_COOKIE_NAME];

    if (cashierCookie) {
      const result =
        await this.cashierSessionService.authenticateCashierSession(
          request,
          response
        );

      if (result.authenticated) {
        this.logger.debug(`Cashier auth success: user=${result.userId}`);
        this.injectUser(request, result);
        return true;
      }
    }

    // ── 3. No valid session ─────────────────────────────────────────────────
    this.logger.warn(`Auth rejected [${request.ip}]: no valid session`);
    throw new UnauthorizedException("Inicia sesión para continuar");
  }

  private injectUser(request: Request, result: SessionResult): void {
    (request as unknown as Record<string, unknown>)["user"] = result;
  }
}
