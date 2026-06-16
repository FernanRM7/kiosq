import { SetMetadata } from "@nestjs/common";

/** Metadata key used by AuthGuard to identify public routes */
export const IS_PUBLIC_KEY = "isPublic";

/**
 * Marks a route handler or controller as publicly accessible.
 *
 * When applied, `AuthGuard` will skip session validation entirely for that
 * route, allowing unauthenticated requests to pass through without a 401.
 *
 * Apply at the **handler** level to make a single endpoint public within a
 * otherwise protected controller, or at the **class** level to make all
 * endpoints in that controller public.
 *
 * @example — single public endpoint in a protected controller
 * ```ts
 * @Controller('auth')
 * export class AuthController {
 *   @Public()
 *   @Get('callback')
 *   callback() { ... }
 * }
 * ```
 *
 * @example — entire controller is public
 * ```ts
 * @Public()
 * @Controller('health')
 * export class HealthController { ... }
 * ```
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
