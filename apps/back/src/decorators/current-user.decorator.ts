import { createParamDecorator, ExecutionContext } from "@nestjs/common";

import type { SessionRequest } from "../types/authenticated-request.type";
import type { AuthenticatedSessionResult } from "../types/session.type";

/**
 * Parameter decorator that extracts the authenticated session result from the request.
 *
 * Must be used inside a route guarded by `AuthGuard` — the guard is responsible
 * for validating the `wos-session` cookie and populating `request.user` before
 * this decorator is evaluated.
 *
 * @example
 * ```ts
 * @Get()
 * @UseGuards(AuthGuard)
 * getProfile(@CurrentUser() user: AuthenticatedSessionResult) {
 *   return user.userId;
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedSessionResult => {
    const request = ctx.switchToHttp().getRequest<SessionRequest>();
    return request.user;
  }
);
