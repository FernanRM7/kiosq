import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";

import { Public } from "../decorators/public.decorator";
import { getRedisClient } from "../lib/redis.lib";
import { PrismaService } from "../lib/prisma.service";
import { CashierSessionService } from "../services/cashier-session.service";

@Controller()
export class CashierAuthController {
  private readonly logger = new Logger(CashierAuthController.name);

  constructor(
    private readonly cashierSessionService: CashierSessionService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Lists active cashiers for a tenant by its slug.
   * Public — the cashier has no session yet.
   */
  @Public()
  @Get("workspaces/:slug/cashiers")
  @HttpCode(HttpStatus.OK)
  async listCashiers(@Param("slug") slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      select: { id: true },
      where: { slug },
    });

    if (!tenant) {
      return [];
    }

    const cashiers = await this.prisma.userTenant.findMany({
      select: {
        user: { select: { id: true, name: true, cashierCode: true } },
      },
      where: {
        role: "CASHIER",
        status: "ACTIVE",
        tenantId: tenant.id,
        user: { pinHash: { not: null } },
      },
    });

    return cashiers.map((m) => ({
      code: m.user.cashierCode ?? "",
      id: m.user.id,
      name: m.user.name,
    }));
  }

  // (reserved for future multi-tenant kiosk support)

  /**
   * Logs in a cashier by code + PIN.
   * On success: sets cashier-session cookie and returns redirectTo.
   * Public — the cashier has no session yet.
   */
  @Public()
  @Post("auth/pin")
  @HttpCode(HttpStatus.OK)
  async loginWithPin(
    @Body() body: { code: string; pin: string; slug?: string },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!body.code) {
      return { statusCode: 400, message: "El código es obligatorio" };
    }

    const result = await this.cashierSessionService.loginWithPin(
      body.code,
      body.pin,
      body.slug,
      request,
      response,
    );

    if (result.authenticated) {
      return { redirectTo: "/dashboard" };
    }

    return { statusCode: 401, message: "Código o PIN incorrecto" };
  }

  /**
   * Logs out the current cashier session.
   * Clears the cookie and deletes the Redis key.
   */
  @Public()
  @Post("auth/pin/logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: Request, @Res() response: Response) {
    const cashierId = request.cookies?.["cashier-session"];

    if (cashierId) {
      try {
        getRedisClient().del(`cashier_session:${cashierId}`);
      } catch (error) {
        this.logger.warn(`Failed to delete cashier session: ${error}`);
      }
    }

    response.clearCookie("cashier-session", { path: "/" });
    response.status(HttpStatus.NO_CONTENT).send();
  }
}
