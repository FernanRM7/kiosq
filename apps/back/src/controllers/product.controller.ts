import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
  create(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Body() body: CreateProductDto
  ): Promise<ProductResponse> {
    return this.productService.createProduct(session, body);
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  update(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Param() params: ProductIdParamsDto,
    @Body() body: UpdateProductDto
  ): Promise<ProductResponse> {
    return this.productService.updateProduct(session, params.id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  delete(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Param() params: ProductIdParamsDto
  ): Promise<ProductResponse> {
    return this.productService.deleteProduct(session, params.id);
  }
}
