import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from "@nestjs/common";

import { CurrentUser } from "../decorators/current-user.decorator";
import { TeamService } from "../services/team.service";
import type { AuthenticatedSessionResult } from "../types/session.type";

@Controller("team")
export class TeamController {
  private readonly logger = new Logger(TeamController.name);

  constructor(private readonly teamService: TeamService) {}

  @Post("cashiers")
  @HttpCode(HttpStatus.CREATED)
  async createCashier(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Body() body: { name: string; email?: string; pin: string },
  ) {
    const { userId } = session;

    // Validate PIN format (4-6 numeric digits)
    if (!/^\d{4,6}$/.test(body.pin)) {
      return { statusCode: 400, message: "El PIN debe tener 4-6 dígitos numéricos" };
    }

    if (!body.name || body.name.trim().length === 0) {
      return { statusCode: 400, message: "El nombre es obligatorio" };
    }

    return this.teamService.createCashier(userId, {
      name: body.name.trim(),
      email: body.email,
      pin: body.pin,
    });
  }
}
