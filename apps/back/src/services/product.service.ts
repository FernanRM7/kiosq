import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../lib/prisma.service";
import type {
  CreateProductInput,
  UpdateProductInput,
} from "../schemas/product.schema";
import type { AuthenticatedSessionResult } from "../types/session.type";

const productInclude = {
  branches: {
    select: {
      stock: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.ProductInclude;

type ProductRecord = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

export interface ProductResponse {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  price: number;
  cost: number | null;
  taxRate: number;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  imageUrl: string | null;
  isActive: boolean;
  totalStock: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listProducts(
    session: AuthenticatedSessionResult
  ): Promise<ProductResponse[]> {
    const userContext = await this.getUserContext(session.userId);
    const { tenantId } = userContext;
    const canSeeCost = userContext.role !== "CASHIER";

    const products = await this.prisma.product.findMany({
      include: productInclude,
      orderBy: { name: "asc" },
      where: { isActive: true, tenantId },
    });

    return products.map((product) => this.toResponse(product, canSeeCost));
  }

  async createProduct(
    session: AuthenticatedSessionResult,
    input: CreateProductInput
  ): Promise<ProductResponse> {
    const userContext = await this.getUserContext(session.userId);
    this.assertCanManageCatalog(userContext.role);
    const { tenantId } = userContext;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const categoryId = await this.resolveCategoryId(
          tx,
          tenantId,
          input.categoryId
        );

        const product = await tx.product.create({
          data: {
            barcode: this.nullableText(input.barcode),
            categoryId,
            cost:
              input.cost === null || input.cost === undefined
                ? null
                : this.toDecimalString(input.cost, 2),
            description: this.nullableText(input.description),
            imageUrl: this.nullableText(input.imageUrl),
            name: input.name.trim(),
            price: this.toDecimalString(input.price, 2),
            sku: input.sku.trim(),
            taxRate: this.toDecimalString(input.taxRate ?? 0, 4),
            tenantId,
          },
          include: productInclude,
        });

        if (input.stock && input.stock > 0) {
          const branchId = await this.resolveBranchId(
            tx,
            tenantId,
            session.userId
          );
          if (branchId) {
            await tx.productBranch.create({
              data: {
                branchId,
                productId: product.id,
                stock: input.stock,
              },
            });
          }
        }

        return this.toResponse(product, true);
      });
    } catch (error) {
      this.logger.error(
        { err: error, tenantId, userId: session.userId },
        "Failed to create product"
      );
      this.handlePrismaError(error);
    }
  }

  async updateProduct(
    session: AuthenticatedSessionResult,
    productId: string,
    input: UpdateProductInput
  ): Promise<ProductResponse> {
    const userContext = await this.getUserContext(session.userId);
    this.assertCanManageCatalog(userContext.role);
    const { tenantId } = userContext;

    try {
      // eslint-disable-next-line complexity
      return await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.findFirst({
          select: { id: true },
          where: { id: productId, isActive: true, tenantId },
        });

        if (!product) {
          throw new NotFoundException("Producto no encontrado");
        }

        const categoryId =
          "categoryId" in input
            ? await this.resolveCategoryId(tx, tenantId, input.categoryId)
            : undefined;

        const updatedProduct = await tx.product.update({
          data: {
            ...("barcode" in input
              ? { barcode: this.nullableText(input.barcode) }
              : {}),
            ...("categoryId" in input ? { categoryId } : {}),
            ...("cost" in input
              ? {
                  cost:
                    input.cost === null || input.cost === undefined
                      ? null
                      : this.toDecimalString(input.cost, 2),
                }
              : {}),
            ...("description" in input
              ? { description: this.nullableText(input.description) }
              : {}),
            ...("imageUrl" in input
              ? { imageUrl: this.nullableText(input.imageUrl) }
              : {}),
            ...("name" in input && input.name
              ? { name: input.name.trim() }
              : {}),
            ...("price" in input && input.price !== undefined
              ? { price: this.toDecimalString(input.price, 2) }
              : {}),
            ...("sku" in input && input.sku ? { sku: input.sku.trim() } : {}),
            ...("taxRate" in input && input.taxRate !== undefined
              ? { taxRate: this.toDecimalString(input.taxRate, 4) }
              : {}),
          },
          include: productInclude,
          where: { id: productId },
        });

        if (
          "stock" in input &&
          input.stock !== undefined &&
          input.stock !== null
        ) {
          const branchId = await this.resolveBranchId(
            tx,
            tenantId,
            session.userId
          );
          if (branchId) {
            await tx.productBranch.upsert({
              create: {
                branchId,
                productId,
                stock: input.stock,
              },
              update: { stock: input.stock },
              where: {
                productId_branchId: { branchId, productId },
              },
            });
          }
        }

        return this.toResponse(updatedProduct, true);
      });
    } catch (error) {
      this.logger.error(
        { err: error, productId, tenantId, userId: session.userId },
        "Failed to update product"
      );
      this.handlePrismaError(error);
    }
  }

  async deleteProduct(
    session: AuthenticatedSessionResult,
    productId: string
  ): Promise<ProductResponse> {
    const userContext = await this.getUserContext(session.userId);
    this.assertCanManageCatalog(userContext.role);
    const { tenantId } = userContext;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.findFirst({
          select: { id: true },
          where: { id: productId, isActive: true, tenantId },
        });

        if (!product) {
          throw new NotFoundException("Producto no encontrado");
        }

        const deletedProduct = await tx.product.update({
          data: { isActive: false },
          include: productInclude,
          where: { id: productId },
        });

        return this.toResponse(deletedProduct, true);
      });
    } catch (error) {
      this.logger.error(
        { err: error, productId, tenantId, userId: session.userId },
        "Failed to delete product"
      );
      throw error;
    }
  }

  private async getUserContext(userId: string): Promise<{
    role: string;
    tenantId: string;
  }> {
    const user = await this.prisma.user.findFirst({
      select: { isActive: true, role: true, tenantId: true },
      where: { OR: [{ workosUserId: userId }, { id: userId }] },
    });

    if (!user?.isActive) {
      throw new ForbiddenException("Debes tener un workspace activo");
    }

    return {
      role: user.role,
      tenantId: user.tenantId,
    };
  }

  private async getTenantId(userId: string): Promise<string> {
    const { tenantId } = await this.getUserContext(userId);

    return tenantId;
  }

  private assertCanManageCatalog(role: string): void {
    if (role === "CASHIER") {
      throw new ForbiddenException(
        "No tienes permisos para administrar el catálogo"
      );
    }
  }

  private async resolveBranchId(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string
  ): Promise<string | null> {
    const user = await tx.user.findUnique({
      select: { branchId: true },
      where: { workosUserId: userId },
    });

    if (user?.branchId) {
      return user.branchId;
    }

    const branch = await tx.branch.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
      where: { tenantId },
    });

    if (branch) {
      return branch.id;
    }

    const defaultBranch = await tx.branch.create({
      data: { name: "Sucursal principal", tenantId },
    });

    await tx.user.update({
      data: { branchId: defaultBranch.id },
      where: { workosUserId: userId },
    });

    return defaultBranch.id;
  }

  private async resolveCategoryId(
    tx: Prisma.TransactionClient,
    tenantId: string,
    categoryId: string | null | undefined
  ): Promise<string | null> {
    const normalizedCategoryId = this.nullableText(categoryId);

    if (!normalizedCategoryId) {
      return null;
    }

    const category = await tx.category.findFirst({
      select: { id: true },
      where: { id: normalizedCategoryId, isActive: true, tenantId },
    });

    if (!category) {
      throw new BadRequestException({
        code: "INVALID_CATEGORY",
        message: "La categoría no existe o no pertenece al workspace",
      });
    }

    return category.id;
  }

  private nullableText(value: string | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const trimmed = value.trim();

    return trimmed || null;
  }

  private toDecimalString(value: number, decimals: number): string {
    return value.toFixed(decimals);
  }

  private toResponse(
    product: ProductRecord,
    includeCost: boolean
  ): ProductResponse {
    return {
      barcode: product.barcode,
      category: product.category,
      categoryId: product.categoryId,
      cost: includeCost ? this.decimalToNumber(product.cost) : null,
      createdAt: product.createdAt.toISOString(),
      description: product.description,
      id: product.id,
      imageUrl: product.imageUrl,
      isActive: product.isActive,
      name: product.name,
      price: this.requiredDecimalToNumber(product.price),
      sku: product.sku,
      taxRate: this.requiredDecimalToNumber(product.taxRate),
      totalStock: product.branches.reduce(
        (sum, branch) => sum + branch.stock,
        0
      ),
      updatedAt: product.updatedAt.toISOString(),
    };
  }

  private requiredDecimalToNumber(value: { toString: () => string }): number {
    return Number(value.toString());
  }

  private decimalToNumber(
    value: { toString: () => string } | null
  ): number | null {
    if (value === null) {
      return null;
    }

    return Number(value.toString());
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException("Ya existe un producto con ese SKU");
    }

    throw error;
  }
}
