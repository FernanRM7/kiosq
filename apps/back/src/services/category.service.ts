import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Category as CategoryRecord } from "@prisma/client";

import { PrismaService } from "../lib/prisma.service";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "../schemas/category.schema";
import type { AuthenticatedSessionResult } from "../types/session.type";

export interface CategoryResponse {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryListResponse {
  active: CategoryResponse[];
  deleted: CategoryResponse[];
}

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listCategories(
    session: AuthenticatedSessionResult
  ): Promise<CategoryListResponse> {
    const tenantId = await this.getTenantId(session.userId);

    const [active, deleted] = await Promise.all([
      this.prisma.category.findMany({
        orderBy: { name: "asc" },
        where: { isActive: true, tenantId },
      }),
      this.prisma.category.findMany({
        orderBy: { name: "asc" },
        where: { isActive: false, tenantId },
      }),
    ]);

    return {
      active: active.map((category) => this.toResponse(category)),
      deleted: deleted.map((category) => this.toResponse(category)),
    };
  }

  async createCategory(
    session: AuthenticatedSessionResult,
    input: CreateCategoryInput
  ): Promise<CategoryResponse> {
    const tenantId = await this.getTenantId(session.userId);

    try {
      const category = await this.prisma.category.create({
        data: {
          name: input.name.trim(),
          tenantId,
        },
      });

      return this.toResponse(category);
    } catch (error) {
      this.logger.error(
        { err: error, tenantId, userId: session.userId },
        "Failed to create category"
      );
      this.handlePrismaError(error);
    }
  }

  async updateCategory(
    session: AuthenticatedSessionResult,
    categoryId: string,
    input: UpdateCategoryInput
  ): Promise<CategoryResponse> {
    const tenantId = await this.getTenantId(session.userId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const category = await tx.category.findFirst({
          select: { id: true },
          where: { id: categoryId, isActive: true, tenantId },
        });

        if (!category) {
          throw new NotFoundException("Categoría no encontrada");
        }

        const data: Prisma.CategoryUpdateInput = {};

        if ("name" in input && input.name) {
          data.name = input.name.trim();
        }

        const updatedCategory = await tx.category.update({
          data,
          where: { id: categoryId },
        });

        return this.toResponse(updatedCategory);
      });
    } catch (error) {
      this.logger.error(
        { categoryId, err: error, tenantId, userId: session.userId },
        "Failed to update category"
      );
      this.handlePrismaError(error);
    }
  }

  async deleteCategory(
    session: AuthenticatedSessionResult,
    categoryId: string
  ): Promise<CategoryResponse> {
    const tenantId = await this.getTenantId(session.userId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const category = await tx.category.findFirst({
          select: { id: true },
          where: { id: categoryId, isActive: true, tenantId },
        });

        if (!category) {
          throw new NotFoundException("Categoría no encontrada");
        }

        const deletedCategory = await tx.category.update({
          data: { isActive: false },
          where: { id: categoryId },
        });

        return this.toResponse(deletedCategory);
      });
    } catch (error) {
      this.logger.error(
        { categoryId, err: error, tenantId, userId: session.userId },
        "Failed to delete category"
      );
      throw error;
    }
  }

  async restoreCategory(
    session: AuthenticatedSessionResult,
    categoryId: string
  ): Promise<CategoryResponse> {
    const tenantId = await this.getTenantId(session.userId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const category = await tx.category.findFirst({
          select: { id: true },
          where: { id: categoryId, isActive: false, tenantId },
        });

        if (!category) {
          throw new NotFoundException("Categoría no encontrada");
        }

        const restoredCategory = await tx.category.update({
          data: { isActive: true },
          where: { id: categoryId },
        });

        return this.toResponse(restoredCategory);
      });
    } catch (error) {
      this.logger.error(
        { categoryId, err: error, tenantId, userId: session.userId },
        "Failed to restore category"
      );
      throw error;
    }
  }

  private async getTenantId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      select: { isActive: true, tenantId: true },
      where: { workosUserId: userId },
    });

    if (!user?.isActive) {
      throw new ForbiddenException("Debes tener un workspace activo");
    }

    return user.tenantId;
  }

  private toResponse(category: CategoryRecord): CategoryResponse {
    return {
      createdAt: category.createdAt.toISOString(),
      id: category.id,
      isActive: category.isActive,
      name: category.name,
      updatedAt: category.updatedAt.toISOString(),
    };
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException("Ya existe una categoría con ese nombre");
    }

    throw error;
  }
}
