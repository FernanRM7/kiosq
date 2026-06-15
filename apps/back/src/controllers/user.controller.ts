import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { AuthGuard } from "../middlewares/auth.guard";
import { ApiErrorResponseSchema } from "../schemas/api-response.schema";
import { MeResponseSchema } from "../schemas/me-response.schema";
import { MeSuccessResponseSchema } from "../schemas/me-success-response.schema";
import { UserService } from "../services/user.service";
import type { SessionRequest } from "../types/authenticated-request.type";

@ApiTags("Users")
@ApiCookieAuth("wos-session")
@ApiBearerAuth("access-token")
@Controller("me")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
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
  getMe(@Req() request: SessionRequest): MeResponseSchema {
    return this.userService.buildMeResponse(request.user);
  }
}
