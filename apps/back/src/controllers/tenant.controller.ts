import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";

import { CurrentUser } from "../decorators/current-user.decorator";
import { TenantService } from "../services/tenant.service";
import type { AuthenticatedSessionResult } from "../types/session.type";

@Controller("tenants")
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  list(@CurrentUser() session: AuthenticatedSessionResult) {
    return this.tenantService.listUserTenants(session.userId);
  }

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

  @Post(":id/switch")
  @HttpCode(HttpStatus.OK)
  async switchTenant(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Param("id") tenantId: string
  ) {
    const tenant = await this.tenantService.switchTenant(
      session.userId,
      tenantId
    );
    return { tenant };
  }
}
