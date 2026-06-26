import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { CurrentUser } from "../decorators/current-user.decorator";
import { ApiErrorResponseSchema } from "../schemas/api-response.schema";
import { MeResponseSchema } from "../schemas/me-response.schema";
import { MeSuccessResponseSchema } from "../schemas/me-success-response.schema";
import { SessionRegistryService } from "../services/session-registry.service";
import { SessionService } from "../services/session.service";
import { UserService } from "../services/user.service";
import type { AuthenticatedSessionResult } from "../types/session.type";

@ApiTags("Users")
@ApiCookieAuth("wos-session")
@ApiBearerAuth("access-token")
@Controller("me")
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(
    private readonly userService: UserService,
    private readonly sessionRegistry: SessionRegistryService,
    private readonly sessionService: SessionService
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    description: `
Returns the profile of the currently authenticated user.

**Authentication:** Requires a valid \`wos-session\` cookie issued by WorkOS AuthKit.

**Token rotation:** Handled automatically. If the access token inside the sealed session
has expired, the API transparently refreshes it via WorkOS and sets a new \`wos-session\`
cookie in the response before returning this endpoint's data.
    `.trim(),
    summary: "Get current user profile",
  })
  @ApiResponse({
    description: "Authenticated user profile.",
    status: HttpStatus.OK,
    type: MeSuccessResponseSchema,
  })
  @ApiResponse({
    description:
      "No valid session cookie found or session has been revoked. Re-authenticate to obtain a new session.",
    status: HttpStatus.UNAUTHORIZED,
    type: ApiErrorResponseSchema,
  })
  getMe(@CurrentUser() session: AuthenticatedSessionResult): MeResponseSchema {
    this.logger.log(`GET /me`, { userId: session.userId });
    return this.userService.buildMeResponse(session);
  }

  @Get("sessions")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    description: `
Returns all active sessions for the currently authenticated user.

Each session includes metadata such as device info, IP address, creation time,
and last activity timestamp. The current session is included in the list.
    `.trim(),
    summary: "List active sessions",
  })
  @ApiResponse({
    description: "List of active sessions.",
    status: HttpStatus.OK,
  })
  @ApiResponse({
    description: "No valid session cookie found.",
    status: HttpStatus.UNAUTHORIZED,
    type: ApiErrorResponseSchema,
  })
  async getSessions(
    @CurrentUser() session: AuthenticatedSessionResult
  ): Promise<Record<string, unknown>[]> {
    try {
      const sessions = await this.sessionRegistry.getSessionsForUser(
        session.userId
      );

      this.logger.log(`GET /me/sessions: ${sessions.length} sessions`, {
        userId: session.userId,
      });

      return sessions.map((s) => ({
        ...s,
        isCurrent: s.sessionId === session.sessionId,
      }));
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId: session.userId,
        },
        "Failed to fetch sessions"
      );
      throw error;
    }
  }

  @Delete("sessions/:sessionId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    description: `
Revokes a specific session by its ID. The revoked session will no longer
be valid for authentication. The current session cannot be revoked via this endpoint.
    `.trim(),
    summary: "Revoke a session",
  })
  @ApiParam({
    description: "The session ID to revoke",
    name: "sessionId",
    type: String,
  })
  @ApiResponse({
    description: "Session revoked successfully.",
    status: HttpStatus.OK,
  })
  @ApiResponse({
    description: "Session not found or already revoked.",
    status: HttpStatus.NOT_FOUND,
    type: ApiErrorResponseSchema,
  })
  async revokeSession(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Param("sessionId") sessionId: string
  ): Promise<{ success: boolean }> {
    if (sessionId === session.sessionId) {
      return { success: false };
    }

    try {
      await this.sessionService.revokeSession(session.userId, sessionId);
      this.logger.log(`Session revoked`, { sessionId, userId: session.userId });
      return { success: true };
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          sessionId,
          userId: session.userId,
        },
        "Failed to revoke session"
      );
      throw error;
    }
  }
}
