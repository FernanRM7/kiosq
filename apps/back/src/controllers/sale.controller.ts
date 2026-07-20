import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from "@nestjs/common";

import { CurrentUser } from "../decorators/current-user.decorator";
import { CreateSaleDto } from "../schemas/create-sale.dto";
import { SaleService } from "../services/sale.service";
import type { SaleResponse } from "../services/sale.service";
import type { AuthenticatedSessionResult } from "../types/session.type";

@Controller("sales")
export class SaleController {
  private readonly logger = new Logger(SaleController.name);

  constructor(private readonly saleService: SaleService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  list(
    @CurrentUser() session: AuthenticatedSessionResult
  ): Promise<SaleResponse[]> {
    return this.saleService.listSales(session);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Body() body: CreateSaleDto
  ): Promise<SaleResponse> {
    try {
      const sale = await this.saleService.createSale(session, body);
      this.logger.log(`Sale created`, {
        saleId: sale.id,
        tenantId: session.tenantId ?? session.organizationId,
        userId: session.userId,
      });
      return sale;
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId: session.userId,
        },
        "Failed to create sale"
      );
      throw error;
    }
  }
}
