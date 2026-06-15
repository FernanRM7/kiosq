import {
  Controller,
  Get,
  HttpStatus,
  Logger,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiExcludeEndpoint,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";

import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from "../constants/cookie.constants";
import { AuthService } from "../services/auth.service";

/** Error reasons returned by WorkOS in the `error` query param */
const WORKOS_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Authentication was cancelled or denied.",
  invalid_client: "Invalid WorkOS client configuration.",
  invalid_grant: "Authorization code is invalid or has already been used.",
  server_error: "WorkOS encountered an internal error. Please try again.",
};

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

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
    @Res() response: Response
  ): Promise<void> {
    const loginUrl = `${this.authService.appUrl}/login`;
    const dashboardUrl = `${this.authService.appUrl}/dashboard`;

    // ── 1. Handle WorkOS-side errors ─────────────────────────────────────────
    if (error) {
      const message =
        WORKOS_ERROR_MESSAGES[error] ??
        errorDescription ??
        "Authentication failed.";

      this.logger.warn(
        `WorkOS callback error: ${error} — ${errorDescription ?? "no description"}`
      );

      response.redirect(
        `${loginUrl}?error=${encodeURIComponent(error)}&message=${encodeURIComponent(message)}`
      );

      return;
    }

    // ── 2. Validate code presence ─────────────────────────────────────────────
    if (!code) {
      this.logger.warn("Callback received without a code parameter");

      response.redirect(
        `${loginUrl}?error=missing_code&message=${encodeURIComponent("Authorization code was not provided.")}`
      );

      return;
    }

    // ── 3. Exchange code for sealed session ───────────────────────────────────
    try {
      const { sealedSession, userId, organizationId } =
        await this.authService.exchangeCodeForSession(code);

      response.cookie(
        SESSION_COOKIE_NAME,
        sealedSession,
        SESSION_COOKIE_OPTIONS
      );

      this.logger.log(
        `Session established for user ${userId}${organizationId ? ` (org: ${organizationId})` : ""}`
      );

      response.redirect(dashboardUrl);
    } catch (exchangeError) {
      const reason =
        exchangeError instanceof Error
          ? exchangeError.message
          : "Unknown error during code exchange";

      this.logger.error(`Code exchange failed: ${reason}`, exchangeError);

      // Never expose raw exchange errors to the browser — use a generic message
      response.redirect(
        `${loginUrl}?error=exchange_failed&message=${encodeURIComponent("Authentication could not be completed. Please try again.")}`
      );
    }
  }
}
