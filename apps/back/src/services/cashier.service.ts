import { pbkdf2Sync } from "node:crypto";

import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";

import { isMissingPrismaTableError } from "../lib/prisma-errors";
import { PrismaService } from "../lib/prisma.service";

const CASHIER_SHIFTS_TABLE = "public.cashier_shifts";

interface CashierLoginResult {
  cashier: {
    id: string;
    name: string;
    tenantId: string;
    tenantSlug: string;
  };
  openingCash: number;
}

interface ClosedShiftSummary {
  closingCash: number;
  closedAt: string;
  dailySales: number;
  id: string;
  openingCash: number;
  openedAt: string;
  soldProducts: {
    name: string;
    quantity: number;
    total: number;
  }[];
}

const DEFAULT_OPENING_CASH = 500;

@Injectable()
export class CashierService {
  private readonly logger = new Logger(CashierService.name);

  constructor(private readonly prisma: PrismaService) {}

  async authenticateCashierLogin(input: {
    cashierCode: string;
    pin: string;
    tenantSlug: string;
  }): Promise<CashierLoginResult> {
    const cashierCode = input.cashierCode.trim().toUpperCase();
    const tenantSlug = input.tenantSlug.trim().toLowerCase();
    const pin = input.pin.trim();

    const cashier = await this.prisma.user.findFirst({
      select: {
        id: true,
        isActive: true,
        name: true,
        pinHash: true,
        tenant: {
          select: {
            id: true,
            settings: true,
            slug: true,
            status: true,
          },
        },
        tenantId: true,
      },
      where: {
        cashierCode,
        isActive: true,
        role: "CASHIER",
        tenant: { slug: tenantSlug },
      },
    });

    if (!cashier || !cashier.pinHash) {
      throw new UnauthorizedException("Credenciales de cajero inválidas");
    }

    if (cashier.tenant.status === "CANCELLED") {
      throw new UnauthorizedException("Credenciales de cajero inválidas");
    }

    if (!this.verifyPin(pin, cashier.pinHash)) {
      throw new UnauthorizedException("Credenciales de cajero inválidas");
    }

    const openingCash = this.resolveOpeningCash(cashier.tenant.settings);

    return {
      cashier: {
        id: cashier.id,
        name: cashier.name,
        tenantId: cashier.tenantId,
        tenantSlug: cashier.tenant.slug,
      },
      openingCash,
    };
  }

  async openCashierShift(cashierId: string): Promise<void> {
    const cashier = await this.prisma.user.findUnique({
      select: {
        tenant: { select: { status: true } },
        tenantId: true,
      },
      where: { id: cashierId },
    });

    if (!cashier) {
      throw new BadRequestException("El cajero no existe");
    }

    if (cashier.tenant?.status === "CANCELLED") {
      throw new BadRequestException("El negocio no está activo");
    }

    const tenant = await this.prisma.tenant.findUnique({
      select: { settings: true, status: true },
      where: { id: cashier.tenantId },
    });

    if (!tenant || tenant.status === "CANCELLED") {
      throw new BadRequestException("El negocio no está activo");
    }

    try {
      await this.prisma.cashierShift.create({
        data: {
          cashierId,
          openingCash: this.resolveOpeningCash(tenant?.settings),
          tenantId: cashier.tenantId,
        },
      });
    } catch (error) {
      if (isMissingPrismaTableError(error, CASHIER_SHIFTS_TABLE)) {
        this.logger.warn(
          `cashier_shifts table unavailable — skipping shift creation for cashier ${cashierId}`
        );
        return;
      }

      throw error;
    }
  }

  async closeCashierShift(
    cashierId: string
  ): Promise<ClosedShiftSummary | null> {
    const shift = await (async () => {
      try {
        return await this.prisma.cashierShift.findFirst({
          orderBy: { openedAt: "desc" },
          where: {
            cashierId,
            status: "OPEN",
          },
        });
      } catch (error) {
        if (isMissingPrismaTableError(error, CASHIER_SHIFTS_TABLE)) {
          this.logger.warn(
            `cashier_shifts table unavailable — skipping shift close for cashier ${cashierId}`
          );
          return null;
        }

        throw error;
      }
    })();

    if (!shift) {
      return null;
    }

    const sales = await this.prisma.sale.findMany({
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      where: {
        createdAt: { gte: shift.openedAt },
        status: "COMPLETED",
        tenantId: shift.tenantId,
        userId: cashierId,
      },
    });

    const summaryMap = new Map<
      string,
      { name: string; quantity: number; total: number }
    >();
    let dailySales = 0;

    for (const sale of sales) {
      const { total: saleTotal } = sale;
      dailySales += Number(saleTotal.toString());

      for (const item of sale.items) {
        const current = summaryMap.get(item.productId);
        const { quantity, subtotal } = item;
        const total = Number(subtotal.toString());

        if (current) {
          current.quantity += quantity;
          current.total += total;
          continue;
        }

        summaryMap.set(item.productId, {
          name: item.product.name,
          quantity,
          total,
        });
      }
    }

    const soldProducts = [...summaryMap.values()].toSorted(
      (left, right) => right.quantity - left.quantity
    );

    const closingCash = Number(shift.openingCash.toString()) + dailySales;
    const closedAt = new Date();

    const updatedShift = await (async () => {
      try {
        return await this.prisma.cashierShift.update({
          data: {
            closedAt,
            closingCash: closingCash.toFixed(2),
            dailySales: dailySales.toFixed(2),
            soldProducts,
            status: "CLOSED",
          },
          where: { id: shift.id },
        });
      } catch (error) {
        if (isMissingPrismaTableError(error, CASHIER_SHIFTS_TABLE)) {
          this.logger.warn(
            `cashier_shifts table unavailable — skipping shift close for cashier ${cashierId}`
          );
          return null;
        }

        throw error;
      }
    })();

    if (!updatedShift) {
      return null;
    }

    this.logger.log(`Cashier shift closed: ${shift.id}`);

    return {
      closedAt: closedAt.toISOString(),
      closingCash,
      dailySales,
      id: updatedShift.id,
      openedAt: updatedShift.openedAt.toISOString(),
      openingCash: Number(updatedShift.openingCash.toString()),
      soldProducts,
    };
  }

  private resolveOpeningCash(settings: unknown): number {
    if (
      settings &&
      typeof settings === "object" &&
      !Array.isArray(settings) &&
      "cashOpeningAmount" in settings
    ) {
      const opening = (settings as Record<string, unknown>)[
        "cashOpeningAmount"
      ];

      if (typeof opening === "number" && Number.isFinite(opening)) {
        return opening;
      }
    }

    return DEFAULT_OPENING_CASH;
  }

  private verifyPin(pin: string, pinHash: string): boolean {
    const [algorithm, iterations, salt, hash] = pinHash.split("$");

    if (
      algorithm !== "pbkdf2" ||
      !iterations ||
      !salt ||
      !hash ||
      !Number.isInteger(Number(iterations))
    ) {
      return false;
    }

    const computed = pbkdf2Sync(
      pin,
      salt,
      Number(iterations),
      64,
      "sha256"
    ).toString("hex");

    return computed === hash;
  }
}
