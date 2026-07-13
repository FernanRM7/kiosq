import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request, Response } from "express";

import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { cid } from "../lib/request-context";
import { SessionService } from "../services/session.service";

/**
 * Guards routes that require a valid WorkOS sealed session.
 *
 * ## Protected routes
 * Validates the `wos-session` HttpOnly cookie on every request.
 * On success: injects `AuthenticatedSessionResult` into `request.user`.
 * On failure: throws `UnauthorizedException` (HTTP 401).
 *
 * ## Public routes
 * Routes decorated with `@Public()` bypass session validation entirely.
 * Handler-level `@Public()` takes priority over class-level metadata.
 *
 * ## Automatic token rotation
 * Handled transparently by `SessionService`: if the access token inside
 * the sealed session is expired, the session is refreshed via WorkOS and
 * the new sealed cookie is written to the response before the handler runs.
 *
 * @example — protect a single route
 * ```ts
 * @UseGuards(AuthGuard)
 * @Get('profile')
 * getProfile(@CurrentUser() user: AuthenticatedSessionResult) { ... }
 * ```
 *
 * @example — protect an entire controller
 * ```ts
 * @UseGuards(AuthGuard)
 * @Controller('dashboard')
 * export class DashboardController { ... }
 * ```
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // ── Public route check ──────────────────────────────────────────────────
    // Handler-level metadata takes precedence over class-level metadata.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // ── Session validation ──────────────────────────────────────────────────
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const result = await this.sessionService.authenticateSession(
      request,
      response
    );

    if (!result.authenticated) {
      this.logger.warn(
        `${cid()} Auth rejected: reason=${result.reason} ip=${request.ip} method=${request.method} path=${request.originalUrl}`
      );
      throw new UnauthorizedException("Inicia sesión para continuar");
    }

    this.logger.debug(
      `${cid()} Auth success: userId=${result.userId} sessionId=${result.sessionId} method=${request.method} path=${request.originalUrl}`
    );

    // Inject the authenticated session into the request so @CurrentUser()
    // and any downstream middleware can access the session without re-reading the cookie.
    (request as unknown as Record<string, unknown>)["user"] = result;

    return true;
  }
}
