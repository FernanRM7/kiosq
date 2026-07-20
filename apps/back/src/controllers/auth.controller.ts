import { randomUUID } from "node:crypto";

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Request, Response } from "express";

import {
  CASHIER_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from "../constants/cookie.constants";
import { CurrentUser } from "../decorators/current-user.decorator";
import { Public } from "../decorators/public.decorator";
import { cid } from "../lib/request-context";
import { ApiErrorResponseSchema } from "../schemas/api-response.schema";
import { AuthorizationUrlResponseSchema } from "../schemas/authorization-url-response.schema";
import { CashierLoginDto } from "../schemas/cashier-auth.dto";
import { AuthService } from "../services/auth.service";
import { CashierService } from "../services/cashier.service";
import { SessionService } from "../services/session.service";
import type { AuthenticatedSessionResult } from "../types/session.type";

/** Error reasons returned by WorkOS in the `error` query param */
const WORKOS_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "La autenticación fue cancelada o denegada.",
  invalid_client: "La configuración de WorkOS no es válida.",
  invalid_grant: "El código de autorización no es válido o ya se usó.",
  server_error: "WorkOS tuvo un error interno. Intenta de nuevo.",
};

/** Shape of the data returned by POST /auth/logout */
export interface LogoutResponseData {
  /** WorkOS logout URL — navigate the browser here to complete server-side revocation */
  logoutUrl: string;
}

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly cashierService: CashierService,
    private readonly sessionService: SessionService
  ) {}

  /**
   * Generates the WorkOS AuthKit authorization URL.
   *
   * The client must redirect the user's browser to the returned `authorizationUrl`
   * to start the authentication flow (login or register — WorkOS hosted UI handles both).
   * After authentication, WorkOS redirects back to `GET /auth/callback` with a one-time code.
   *
   * ### Optional parameters
   * - `organization_id`: Targets SSO for a specific WorkOS organization.
   *   Use this for multi-tenant login where users select their organization first.
   * - `state`: Opaque string echoed back verbatim in the callback `?state=` param.
   *   Use to restore client-side navigation state or pass CSRF tokens.
   */
  @Public()
  @Get("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    description: `
Generates the WorkOS AuthKit authorization URL.

The client redirects the user's browser to \`authorizationUrl\` to start authentication.
WorkOS presents its hosted login/register UI. After the user authenticates, WorkOS
redirects back to \`GET /auth/callback\` with a one-time authorization \`code\`.

### Usage
\`\`\`ts
const { data } = await fetch('/auth/login').then(r => r.json());
window.location.href = data.authorizationUrl;
\`\`\`

### Organization SSO
Pass \`organization_id\` to target a specific WorkOS organization's SSO provider.
Omit it for the default AuthKit flow (email + social providers).
    `.trim(),
    summary: "Get AuthKit authorization URL",
  })
  @ApiQuery({
    description:
      "WorkOS Organization ID. When provided, targets SSO for that specific organization.",
    name: "organization_id",
    required: false,
    type: String,
  })
  @ApiQuery({
    description:
      "Opaque state string echoed back in the callback. Use for CSRF protection or client-side state.",
    name: "state",
    required: false,
    type: String,
  })
  @ApiResponse({
    description: "WorkOS authorization URL ready for browser redirect.",
    status: HttpStatus.OK,
    type: AuthorizationUrlResponseSchema,
  })
  @ApiResponse({
    description:
      "Server configuration error — WorkOS SDK failed to generate the URL.",
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    type: ApiErrorResponseSchema,
  })
  login(@Query("state") state?: string): AuthorizationUrlResponseSchema {
    const authorizationUrl = this.authService.getAuthorizationUrl({
      state,
    });

    return { authorizationUrl };
  }

  @Public()
  @Post("cashier/login")
  @HttpCode(HttpStatus.OK)
  async cashierLogin(
    @Body() body: CashierLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<{ redirectTo: string }> {
    const { cashier } =
      await this.cashierService.authenticateCashierLogin(body);
    const sessionId = randomUUID();

    await this.sessionService.registerSession(
      cashier.id,
      sessionId,
      {
        email: null,
        name: cashier.name,
      },
      request
    );

    response.cookie(
      CASHIER_SESSION_COOKIE_NAME,
      this.sessionService.createCashierSessionCookieValue(
        cashier.id,
        sessionId
      ),
      SESSION_COOKIE_OPTIONS
    );

    await this.cashierService.openCashierShift(cashier.id);

    this.logger.log(`Cashier logged in`, {
      cashierId: cashier.id,
      tenantId: cashier.tenantId,
    });

    return { redirectTo: `${this.authService.appUrl}/dashboard` };
  }

  /**
   * OAuth2 Authorization Code callback.
   *
   * WorkOS redirects the user's browser here after authentication.
   * This endpoint:
   *   1. Validates the `code` query parameter is present.
   *   2. Exchanges the code for a sealed session via WorkOS SDK.
   *   3. Writes the sealed session to the `wos-session` HttpOnly cookie.
   *   4. Redirects the browser to the frontend dashboard.
   *
   * On any failure the browser is redirected to `/login?error=<reason>`
   * so the frontend can display a user-friendly error message.
   *
   * **This endpoint is called by WorkOS, not by the frontend directly.**
   * The redirect URI must be registered in the WorkOS dashboard.
   */
  @Public()
  @Get("callback")
  @ApiOperation({
    description: `
OAuth2 Authorization Code callback endpoint.

WorkOS redirects the user's browser here after the hosted login UI completes.
The endpoint exchanges the one-time authorization \`code\` for a sealed session,
writes it to an HttpOnly \`wos-session\` cookie, and redirects to the frontend.

**This route is called by WorkOS — not by the frontend application.**
The \`WORKOS_REDIRECT_URI\` environment variable must match the URI registered
in the WorkOS dashboard exactly.

### Error handling
On any error the browser is redirected to \`/login?error=<reason>\` where
\`reason\` is a URL-safe string suitable for display or logging.
    `.trim(),
    summary: "WorkOS OAuth2 callback",
  })
  @ApiQuery({
    description: "One-time authorization code issued by WorkOS.",
    name: "code",
    required: false,
    type: String,
  })
  @ApiQuery({
    description:
      "WorkOS error code present when the authorization flow failed (e.g. access_denied).",
    name: "error",
    required: false,
    type: String,
  })
  @ApiQuery({
    description: "Human-readable description of the WorkOS error.",
    name: "error_description",
    required: false,
    type: String,
  })
  @ApiResponse({
    description:
      "Successful exchange — browser is redirected to the frontend dashboard.",
    headers: {
      Location: {
        description: "Frontend dashboard URL",
        schema: { type: "string" },
      },
      "Set-Cookie": {
        description:
          "HttpOnly wos-session cookie containing the sealed WorkOS session.",
        schema: { type: "string" },
      },
    },
    status: HttpStatus.FOUND,
  })
  @ApiResponse({
    description:
      "Missing or invalid code — browser is redirected to /login?error=<reason>.",
    headers: {
      Location: {
        description: "Frontend login URL with error query param",
        schema: { type: "string" },
      },
    },
    status: HttpStatus.FOUND,
  })
  @ApiExcludeEndpoint(false)
  async callback(
    @Query("code") code: string | undefined,
    @Query("error") error: string | undefined,
    @Query("error_description") errorDescription: string | undefined,
    @Res() response: Response,
    @Req() request: Request
  ): Promise<void> {
    const loginUrl = `${this.authService.appUrl}/login`;
    const onboardingUrl = `${this.authService.appUrl}/onboarding`;

    // ── 1. Handle WorkOS-side errors ─────────────────────────────────────────
    if (error) {
      const message =
        WORKOS_ERROR_MESSAGES[error] ??
        errorDescription ??
        "Authentication failed.";

      this.logger.warn(
        `${cid()} WorkOS callback error: error=${error} description=${errorDescription ?? "none"}`
      );

      response.redirect(
        `${loginUrl}?error=${encodeURIComponent(error)}&message=${encodeURIComponent(message)}`
      );

      return;
    }

    // ── 2. Validate code presence ─────────────────────────────────────────────
    if (!code) {
      this.logger.warn(`${cid()} Callback received without a code parameter`);

      response.redirect(
        `${loginUrl}?error=missing_code&message=${encodeURIComponent("Authorization code was not provided.")}`
      );

      return;
    }

    // ── 3. Exchange code for sealed session ───────────────────────────────────
    try {
      const { sealedSession, userId, organizationId } =
        await this.authService.exchangeCodeForSession(code);

      this.logger.log(
        `${cid()} Code exchange successful: userId=${userId} organizationId=${organizationId ?? "none"} hasSession=${!!sealedSession}`
      );

      response.cookie(
        SESSION_COOKIE_NAME,
        sealedSession,
        SESSION_COOKIE_OPTIONS
      );

      // Register session in Redis for tracking
      try {
        const loadResult =
          await this.authService.workos.userManagement.loadSealedSession({
            cookiePassword: this.authService.cookiePassword,
            sessionData: sealedSession,
          });
        const authResult = await loadResult.authenticate();

        if (authResult.authenticated) {
          await this.sessionService.registerSession(
            userId,
            String(authResult.sessionId ?? ""),
            authResult.user,
            request
          );
          this.logger.log(
            `${cid()} Session registered in Redis: userId=${userId} sessionId=${String(authResult.sessionId ?? "unknown")}`
          );
        }
      } catch (regError) {
        this.logger.warn(
          `${cid()} Failed to register session in Redis: ${regError instanceof Error ? regError.message : String(regError)}`
        );
      }

      this.logger.log(
        `${cid()} Session established — redirecting to onboarding: userId=${userId}${organizationId ? ` org=${organizationId}` : ""}`
      );

      response.redirect(onboardingUrl);
    } catch (exchangeError) {
      const reason =
        exchangeError instanceof Error
          ? exchangeError.message
          : "Unknown error during code exchange";

      this.logger.error(
        `${cid()} Code exchange failed: ${reason}`,
        exchangeError instanceof Error ? exchangeError.stack : undefined
      );

      // Never expose raw exchange errors to the browser — use a generic message
      response.redirect(
        `${loginUrl}?error=exchange_failed&message=${encodeURIComponent("No se pudo completar la autenticación. Intenta de nuevo.")}`
      );
    }
  }

  /**
   * Terminates the current user session.
   *
   * Flow:
   *   1. AuthGuard validates the `wos-session` cookie and injects `session`.
   *   2. Generate a WorkOS logout URL using the `sessionId` from the session.
   *   3. Clear the local `wos-session` cookie immediately.
   *   4. Return the WorkOS logout URL — the frontend must navigate there
   *      to complete server-side session revocation on WorkOS.
   *
   * After the client visits the returned `logoutUrl`, WorkOS invalidates
   * the session and redirects to the post-logout URL configured in the
   * WorkOS dashboard.
   *
   * **Requires authentication.** A valid `wos-session` cookie must be present.
   */
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth("wos-session")
  @ApiOperation({
    description: `
Terminates the authenticated user's session.

### Steps performed by this endpoint
1. Validates the \`wos-session\` cookie (via AuthGuard).
2. Generates a WorkOS logout URL using the current \`sessionId\`.
3. Clears the \`wos-session\` cookie immediately (local invalidation).
4. Returns \`{ logoutUrl }\` — the frontend **must** navigate the browser
   to this URL to complete server-side revocation on WorkOS.

### Frontend integration
\`\`\`ts
const { data } = await fetch('/auth/logout', { method: 'POST', credentials: 'include' }).then(r => r.json());
window.location.href = data.logoutUrl; // Completes WorkOS revocation
\`\`\`

After WorkOS revocation, the browser is redirected to the post-logout URL
configured in the WorkOS dashboard (typically \`/login\`).
    `.trim(),
    summary: "Logout — invalidate session",
  })
  @ApiResponse({
    description:
      "Session cookie cleared. Returns the WorkOS logout URL for complete server-side revocation.",
    schema: {
      properties: {
        data: {
          properties: {
            logoutUrl: {
              description:
                "Navigate the browser here to complete WorkOS session revocation.",
              example: "https://auth.workos.com/logout?token=...",
              type: "string",
            },
          },
          type: "object",
        },
        success: { example: true, type: "boolean" },
      },
    },
    status: HttpStatus.OK,
  })
  @ApiResponse({
    description:
      "No valid session cookie found. Session may have already expired or been revoked.",
    status: HttpStatus.UNAUTHORIZED,
  })
  async logout(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Res({ passthrough: true }) response: Response
  ): Promise<LogoutResponseData> {
    if (session.authType === "cashier") {
      const closedShift = await this.cashierService.closeCashierShift(
        session.userId
      );

      if (closedShift) {
        this.logger.log(`Cashier shift closed`, {
          cashierId: session.userId,
          shiftId: closedShift.id,
        });
      }

      try {
        await this.sessionService.revokeSession(
          session.userId,
          session.sessionId
        );
      } catch (error) {
        this.logger.warn(
          `Failed to revoke cashier session from Redis: ${error}`
        );
      }

      this.sessionService.clearCashierSession(response);

      return {
        logoutUrl: `${this.authService.appUrl}/login`,
      };
    }

    const logoutUrl = this.authService.getLogoutUrl(session.sessionId);

    this.logger.log(
      `${cid()} Logout initiated: userId=${session.userId} sessionId=${session.sessionId} ` +
        `returnTo=${this.authService.logoutReturnTo} logoutUrl=${logoutUrl}`
    );

    // Revoke session from Redis
    try {
      await this.sessionService.revokeSession(
        session.userId,
        session.sessionId
      );
    } catch (error) {
      this.logger.warn(
        `${cid()} Failed to revoke session from Redis: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Clear the local cookie immediately — the session is considered terminated
    // from the backend's perspective even if the client hasn't visited logoutUrl yet.
    this.sessionService.clearSession(response);

    this.logger.log(
      `${cid()} Logout completed: userId=${session.userId} sessionId=${session.sessionId} returnTo=${this.authService.logoutReturnTo}`
    );

    return { logoutUrl };
  }
}
