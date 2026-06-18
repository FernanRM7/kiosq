import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from "@nestjs/common";

import { CurrentUser } from "../decorators/current-user.decorator";
import { TenantService } from "../services/tenant.service";
import type { AuthenticatedSessionResult } from "../types/session.type";

@Controller("tenants")
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Body("name") name: string
  ) {
    const tenant = await this.tenantService.createTenant(session.userId, name, {
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
    });
    return { tenant };
  }

  @Get("me")
  @HttpCode(HttpStatus.OK)
  getMyTenant(@CurrentUser() session: AuthenticatedSessionResult) {
    return this.tenantService.getTenantByUserId(session.userId);
  }
}
