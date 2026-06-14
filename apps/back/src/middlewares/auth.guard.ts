import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { Request, Response } from "express";

import { SessionService } from "../services/session.service";

/**
 * Guards routes that require a valid WorkOS sealed session.
 *
 * On success: injects `AuthenticatedSessionResult` into `request.user`.
 * On failure: throws `UnauthorizedException` (HTTP 401).
 *
 * Automatic refresh is handled transparently by SessionService:
 * if the access token is expired, the session is refreshed and the
 * new sealed cookie is written to the response before the request continues.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const result = await this.sessionService.authenticateSession(
      request,
      response
    );

    if (!result.authenticated) {
      throw new UnauthorizedException("Authentication required");
    }

    // Inject the authenticated session into the request for controllers
    (request as unknown as Record<string, unknown>)["user"] = result;

    return true;
  }
}
