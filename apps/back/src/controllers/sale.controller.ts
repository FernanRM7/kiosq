import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from "@nestjs/common";

import { CurrentUser } from "../decorators/current-user.decorator";
import { CreateSaleDto } from "../schemas/create-sale.dto";
import { SaleService } from "../services/sale.service";
import type { SaleResponse } from "../services/sale.service";
import type { AuthenticatedSessionResult } from "../types/session.type";

@Controller("sales")
export class SaleController {
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
  create(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Body() body: CreateSaleDto
  ): Promise<SaleResponse> {
    return this.saleService.createSale(session, body);
  }
}
