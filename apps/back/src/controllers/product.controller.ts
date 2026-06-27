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
import { CreateProductDto } from "../schemas/create-product.dto";
import { ProductIdParamsDto } from "../schemas/product-id-params.dto";
import { UpdateProductDto } from "../schemas/update-product.dto";
import { ProductService } from "../services/product.service";
import type { ProductResponse } from "../services/product.service";
import type { AuthenticatedSessionResult } from "../types/session.type";

@Controller("products")
export class ProductController {
  private readonly logger = new Logger(ProductController.name);

  constructor(private readonly productService: ProductService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  list(
    @CurrentUser() session: AuthenticatedSessionResult
  ): Promise<ProductResponse[]> {
    return this.productService.listProducts(session);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Body() body: CreateProductDto
  ): Promise<ProductResponse> {
    const product = await this.productService.createProduct(session, body);
    this.logger.log(`Product created`, {
      productId: product.id,
      userId: session.userId,
    });
    return product;
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  async update(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Param() params: ProductIdParamsDto,
    @Body() body: UpdateProductDto
  ): Promise<ProductResponse> {
    const product = await this.productService.updateProduct(
      session,
      params.id,
      body
    );
    this.logger.log(`Product updated`, {
      productId: product.id,
      userId: session.userId,
    });
    return product;
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async delete(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Param() params: ProductIdParamsDto
  ): Promise<ProductResponse> {
    const product = await this.productService.deleteProduct(session, params.id);
    this.logger.log(`Product deleted`, {
      productId: product.id,
      userId: session.userId,
    });
    return product;
  }
}
