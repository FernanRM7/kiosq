import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
} from "@nestjs/common";

import { CurrentUser } from "../decorators/current-user.decorator";
import { CreateCashierDto } from "../schemas/create-cashier.dto";
import { UpdateTenantSettingsDto } from "../schemas/tenant-dashboard.dto";
import { UpdateCashierDto } from "../schemas/update-cashier.dto";
import { TenantService } from "../services/tenant.service";
import type { AuthenticatedSessionResult } from "../types/session.type";

@Controller("tenants")
export class TenantController {
  private readonly logger = new Logger(TenantController.name);

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
    this.logger.log(`Tenant created`, {
      tenantId: tenant.id,
      userId: session.userId,
    });
    return { tenant };
  }

  @Get("me")
  @HttpCode(HttpStatus.OK)
  getMyTenant(@CurrentUser() session: AuthenticatedSessionResult) {
    return this.tenantService.getTenantByUserId(session.userId);
  }

  @Patch("me/settings")
  @HttpCode(HttpStatus.OK)
  updateMyTenantSettings(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Body() body: UpdateTenantSettingsDto
  ) {
    return this.tenantService.updateTenantSettings(session.userId, body);
  }

  @Post("me/cashiers")
  @HttpCode(HttpStatus.CREATED)
  async createCashier(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Body() body: CreateCashierDto
  ) {
    const tenant = await this.tenantService.createCashier(session.userId, body);
    this.logger.log(`Cashier created`, {
      userId: session.userId,
    });
    return tenant;
  }

  @Patch("me/cashiers/:id")
  @HttpCode(HttpStatus.OK)
  async updateCashier(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Param("id") cashierId: string,
    @Body() body: UpdateCashierDto
  ) {
    const tenant = await this.tenantService.updateCashier(
      session.userId,
      cashierId,
      body
    );
    this.logger.log(`Cashier updated`, {
      cashierId,
      userId: session.userId,
    });
    return tenant;
  }

  @Post(":id/switch")
  @HttpCode(HttpStatus.OK)
  async switchTenant(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Param("id") tenantId: string
  ) {
    const current = await this.tenantService.getTenantByUserId(session.userId);
    const tenant = await this.tenantService.switchTenant(
      session.userId,
      tenantId
    );
    this.logger.log(`Tenant switched`, {
      from: current?.id,
      to: tenantId,
      userId: session.userId,
    });
    return { tenant };
  }
}
