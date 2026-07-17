import {
  BadRequestException,
  Body,
  Controller,
  Get,
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

  @Get("members")
  @HttpCode(HttpStatus.OK)
  async listMembers(@CurrentUser() session: AuthenticatedSessionResult) {
    return this.teamService.listMembers(session.userId);
  }

  @Post("cashiers")
  @HttpCode(HttpStatus.CREATED)
  async createCashier(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Body() body: { name: string; email?: string; pin: string },
  ) {
    const { userId } = session;

    if (!/^\d{4,6}$/.test(body.pin)) {
      throw new BadRequestException(
        "El PIN debe tener 4-6 dígitos numéricos",
      );
    }

    if (!body.name || body.name.trim().length === 0) {
      throw new BadRequestException("El nombre es obligatorio");
    }

    return this.teamService.createCashier(userId, {
      name: body.name.trim(),
      email: body.email,
      pin: body.pin,
    });
  }

  @Post("managers")
  @HttpCode(HttpStatus.CREATED)
  async createManager(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Body() body: { email: string },
  ) {
    const { userId } = session;

    if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      throw new BadRequestException(
        "Debes proporcionar un email válido",
      );
    }

    return this.teamService.createManager(userId, {
      email: body.email.trim(),
    });
  }
}
