import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../lib/prisma.service";
import type { CreateSaleInput } from "../schemas/sale.schema";
import type { AuthenticatedSessionResult } from "../types/session.type";

const saleInclude = {
  items: {
    include: {
      product: {
        select: { id: true, name: true, sku: true },
      },
    },
  },
  payments: true,
} satisfies Prisma.SaleInclude;

type SaleRecord = Prisma.SaleGetPayload<{ include: typeof saleInclude }>;

export interface SaleResponse {
  id: string;
  branchId: string;
  userId: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  createdAt: string;
  items: {
    id: string;
    productId: string;
    product: { id: string; name: string; sku: string };
    quantity: number;
    unitPrice: number;
    taxRate: number;
    subtotal: number;
  }[];
  payments: {
    id: string;
    method: string;
    amount: number;
    reference: string | null;
    status: string;
  }[];
}

@Injectable()
export class SaleService {
  private readonly logger = new Logger(SaleService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listSales(
    session: AuthenticatedSessionResult
  ): Promise<SaleResponse[]> {
    const tenantId = await this.getTenantId(session);

    const sales = await this.prisma.sale.findMany({
      include: saleInclude,
      orderBy: { createdAt: "desc" },
      take: 100,
      where: { tenantId },
    });

    return sales.map((sale) => this.toResponse(sale));
  }

  async createSale(
    session: AuthenticatedSessionResult,
    input: CreateSaleInput
  ): Promise<SaleResponse> {
    const tenantId = await this.getTenantId(session);
    const dbUser = await this.getCurrentUser(session);

    if (!dbUser) {
      throw new ForbiddenException("Usuario no encontrado en el workspace");
    }

    const branchId = input.branchId ?? dbUser.branchId ?? undefined;

    if (!branchId) {
      throw new BadRequestException(
        "No tienes una sucursal asignada. Especifica branchId."
      );
    }

    const branch = await this.prisma.branch.findFirst({
      select: { id: true },
      where: { id: branchId, tenantId },
    });

    if (!branch) {
      throw new BadRequestException("La sucursal no existe o no es tuya");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const productIds = input.items.map((item) => item.productId);

        const products = await tx.product.findMany({
          select: { id: true, name: true, price: true, taxRate: true },
          where: { id: { in: productIds }, isActive: true, tenantId },
        });

        if (products.length !== productIds.length) {
          throw new BadRequestException(
            "Algunos productos no existen o no están activos"
          );
        }

        const productMap = new Map(products.map((p) => [p.id, p]));

        const branchStocks = await tx.productBranch.findMany({
          select: { productId: true, stock: true },
          where: {
            branchId,
            productId: { in: productIds },
          },
        });

        const stockMap = new Map(
          branchStocks.map((s) => [s.productId, s.stock])
        );

        for (const item of input.items) {
          const available = stockMap.get(item.productId) ?? 0;

          if (item.quantity > available) {
            throw new BadRequestException(
              `Stock insuficiente para "${productMap.get(item.productId)?.name ?? item.productId}". Disponible: ${available}`
            );
          }
        }

        const saleItemsData = input.items.map((item) => {
          const product = productMap.get(item.productId);

          if (!product) {
            throw new BadRequestException(
              `Producto "${item.productId}" no encontrado`
            );
          }

          const unitPrice = Number(product.price.toString());
          const taxRate = Number(product.taxRate.toString());
          const subtotal = Number((unitPrice * item.quantity).toFixed(2));

          return {
            productId: product.id,
            quantity: item.quantity,
            subtotal: subtotal.toFixed(2),
            taxRate: taxRate.toFixed(4),
            unitPrice: unitPrice.toFixed(2),
          };
        });

        const saleSubtotal = saleItemsData.reduce(
          (sum, item) => sum + Number(item.subtotal),
          0
        );
        const saleTax = saleItemsData.reduce(
          (sum, item) =>
            sum +
            Number((Number(item.subtotal) * Number(item.taxRate)).toFixed(2)),
          0
        );
        const saleTotal = Number((saleSubtotal + saleTax).toFixed(2));

        const sale = await tx.sale.create({
          data: {
            branchId,
            discountAmount: "0.00",
            items: {
              create: saleItemsData,
            },
            payments: {
              create: {
                amount: saleTotal.toFixed(2),
                method: input.paymentMethod,
                status: "COMPLETED",
              },
            },
            status: "COMPLETED",
            subtotal: saleSubtotal.toFixed(2),
            taxAmount: saleTax.toFixed(2),
            tenantId,
            total: saleTotal.toFixed(2),
            userId: dbUser.id,
          },
          include: saleInclude,
        });

        await Promise.all(
          input.items.map((item) =>
            Promise.all([
              tx.productBranch.updateMany({
                data: { stock: { decrement: item.quantity } },
                where: { branchId, productId: item.productId },
              }),
              tx.stockMovement.create({
                data: {
                  branchId,
                  productId: item.productId,
                  quantity: item.quantity,
                  tenantId,
                  type: "SALE",
                  userId: dbUser.id,
                },
              }),
            ])
          )
        );

        return this.toResponse(sale);
      });
    } catch (error) {
      this.logger.error(
        { branchId, err: error, tenantId, userId: session.userId },
        "Failed to create sale"
      );
      throw error;
    }
  }

  private async getTenantId(
    session: AuthenticatedSessionResult
  ): Promise<string> {
    if (session.tenantId) {
      return session.tenantId;
    }

    const user = await this.prisma.user.findUnique({
      select: { isActive: true, tenantId: true },
      where:
        session.authType === "cashier"
          ? { id: session.userId }
          : { workosUserId: session.userId },
    });

    if (!user?.isActive) {
      throw new ForbiddenException("Debes tener un workspace activo");
    }

    return user.tenantId;
  }

  private getCurrentUser(
    session: AuthenticatedSessionResult
  ): Promise<{ branchId: string | null; id: string } | null> {
    return this.prisma.user.findUnique({
      select: { branchId: true, id: true },
      where:
        session.authType === "cashier"
          ? { id: session.userId }
          : { workosUserId: session.userId },
    });
  }

  private requiredDecimalToNumber(value: { toString: () => string }): number {
    return Number(value.toString());
  }

  private toResponse(sale: SaleRecord): SaleResponse {
    return {
      branchId: sale.branchId,
      createdAt: sale.createdAt.toISOString(),
      discountAmount: this.requiredDecimalToNumber(sale.discountAmount),
      id: sale.id,
      items: sale.items.map((item) => ({
        id: item.id,
        product: item.product,
        productId: item.productId,
        quantity: item.quantity,
        subtotal: this.requiredDecimalToNumber(item.subtotal),
        taxRate: this.requiredDecimalToNumber(item.taxRate),
        unitPrice: this.requiredDecimalToNumber(item.unitPrice),
      })),
      payments: sale.payments.map((payment) => ({
        amount: this.requiredDecimalToNumber(payment.amount),
        id: payment.id,
        method: payment.method,
        reference: payment.reference,
        status: payment.status,
      })),
      status: sale.status,
      subtotal: this.requiredDecimalToNumber(sale.subtotal),
      taxAmount: this.requiredDecimalToNumber(sale.taxAmount),
      total: this.requiredDecimalToNumber(sale.total),
      userId: sale.userId,
    };
  }
}
