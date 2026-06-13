import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { AuthGuard } from "../middlewares/auth.guard";
import { MeResponseSchema } from "../schemas/me-response.schema";
import { UserService } from "../services/user.service";
import type { SessionRequest } from "../types/authenticated-request.type";

@ApiTags("Users")
@Controller("me")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiOperation({
    description:
      "Returns the profile of the authenticated user. Requires a valid session cookie.",
    summary: "Get current user",
  })
  @ApiResponse({
    description: "Authenticated user profile.",
    status: HttpStatus.OK,
    type: MeResponseSchema,
  })
  @ApiResponse({
    description: "No valid session cookie found.",
    status: HttpStatus.UNAUTHORIZED,
  })
  getMe(@Req() request: SessionRequest): MeResponseSchema {
    return this.userService.buildMeResponse(request.user);
  }
}
