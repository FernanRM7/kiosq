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
import { CategoryIdParamsDto } from "../schemas/category-id-params.dto";
import { CreateCategoryDto } from "../schemas/create-category.dto";
import { UpdateCategoryDto } from "../schemas/update-category.dto";
import { CategoryService } from "../services/category.service";
import type {
  CategoryListResponse,
  CategoryResponse,
} from "../services/category.service";
import type { AuthenticatedSessionResult } from "../types/session.type";

@Controller("categories")
export class CategoryController {
  private readonly logger = new Logger(CategoryController.name);

  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  list(
    @CurrentUser() session: AuthenticatedSessionResult
  ): Promise<CategoryListResponse> {
    return this.categoryService.listCategories(session);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Body() body: CreateCategoryDto
  ): Promise<CategoryResponse> {
    const category = await this.categoryService.createCategory(session, body);
    this.logger.log(`Category created`, {
      categoryId: category.id,
      userId: session.userId,
    });
    return category;
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  async update(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Param() params: CategoryIdParamsDto,
    @Body() body: UpdateCategoryDto
  ): Promise<CategoryResponse> {
    const category = await this.categoryService.updateCategory(
      session,
      params.id,
      body
    );
    this.logger.log(`Category updated`, {
      categoryId: category.id,
      userId: session.userId,
    });
    return category;
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async delete(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Param() params: CategoryIdParamsDto
  ): Promise<CategoryResponse> {
    const category = await this.categoryService.deleteCategory(
      session,
      params.id
    );
    this.logger.log(`Category deleted`, {
      categoryId: category.id,
      userId: session.userId,
    });
    return category;
  }

  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  async restore(
    @CurrentUser() session: AuthenticatedSessionResult,
    @Param() params: CategoryIdParamsDto
  ): Promise<CategoryResponse> {
    const category = await this.categoryService.restoreCategory(
      session,
      params.id
    );
    this.logger.log(`Category restored`, {
      categoryId: category.id,
      userId: session.userId,
    });
    return category;
  }
}
