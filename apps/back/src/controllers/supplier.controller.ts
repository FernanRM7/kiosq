import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
} from "@nestjs/common";

import { CurrentUser } from "../decorators/current-user.decorator";
import { CreateSupplierDto } from "../schemas/create-supplier.dto";
import { SupplierIdParamsDto } from "../schemas/supplier-id-params.dto";
import { UpdateSupplierDto } from "../schemas/update-supplier.dto";
import { SupplierService } from "../services/supplier.service";
import type {
  SupplierListResponse,
  SupplierResponse,
} from "../services/supplier.service";
import type { AuthenticatedSessionResult } from "../types/session.type";

@Controller("suppliers")
export class SupplierController {
  private readonly logger = new Logger(SupplierController.name);

  constructor(private readonly supplierService: SupplierService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  list(
    @CurrentUser() session: AuthenticatedSessionResult
  ): Promise<SupplierListResponse> {
    return this.supplierService.listSuppliers(session);
  }

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  async get(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Param() params: SupplierIdParamsDto
  ): Promise<SupplierResponse> {
    const supplier = await this.supplierService.getSupplier(session, params.id);
    this.logger.log(`Supplier fetched`, {
      supplierId: supplier.id,
      userId: session.userId,
    });
    return supplier;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Body() body: CreateSupplierDto
  ): Promise<SupplierResponse> {
    const supplier = await this.supplierService.createSupplier(session, body);
    this.logger.log(`Supplier created`, {
      supplierId: supplier.id,
      userId: session.userId,
    });
    return supplier;
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  async update(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Param() params: SupplierIdParamsDto,
    @Body() body: UpdateSupplierDto
  ): Promise<SupplierResponse> {
    const supplier = await this.supplierService.updateSupplier(
      session,
      params.id,
      body
    );
    this.logger.log(`Supplier updated`, {
      supplierId: supplier.id,
      userId: session.userId,
    });
    return supplier;
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async delete(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Param() params: SupplierIdParamsDto
  ): Promise<SupplierResponse> {
    const supplier = await this.supplierService.deleteSupplier(
      session,
      params.id
    );
    this.logger.log(`Supplier deleted`, {
      supplierId: supplier.id,
      userId: session.userId,
    });
    return supplier;
  }

  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  async restore(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Param() params: SupplierIdParamsDto
  ): Promise<SupplierResponse> {
    const supplier = await this.supplierService.restoreSupplier(
      session,
      params.id
    );
    this.logger.log(`Supplier restored`, {
      supplierId: supplier.id,
      userId: session.userId,
    });
    return supplier;
  }
}
