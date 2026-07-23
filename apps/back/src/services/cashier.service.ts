import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";

import { hashCashierPin, verifyCashierPin } from "../lib/cashier-pin";
import {
  isMissingPrismaTableError,
  isPrismaErrorCode,
} from "../lib/prisma-errors";
import { PrismaService } from "../lib/prisma.service";
import { CashierLoginRateLimitService } from "./cashier-login-rate-limit.service";

const CASHIER_SHIFTS_TABLE = "public.cashier_shifts";
const DUMMY_CASHIER_PIN_HASH =
  "$2b$12$xTCmIfFNp//uSMmaSMH32O1GxwofldSe0y/R4mMO7OM0AF5/1fCLu";

interface CashierLoginResult {
  cashier: {
    id: string;
    name: string;
    pinHash: string;
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly loginRateLimit: CashierLoginRateLimitService
  ) {}

  async authenticateCashierLogin(
    input: {
      cashierCode: string;
      pin: string;
      tenantSlug: string;
    },
    clientAddress: string
  ): Promise<CashierLoginResult> {
    const cashierCode = input.cashierCode.trim().toUpperCase();
    const tenantSlug = input.tenantSlug.trim().toLowerCase();
    const pin = input.pin.trim();
    const attemptContext = { cashierCode, clientAddress, tenantSlug };

    await this.loginRateLimit.consumeAttempt(attemptContext);

    let loginResult: CashierLoginResult;

    try {
      const membership = await this.prisma.userTenant.findFirst({
        select: {
          tenant: {
            select: {
              id: true,
              settings: true,
              slug: true,
              status: true,
            },
          },
          user: {
            select: {
              cashierCode: true,
              id: true,
              isActive: true,
              name: true,
              pinHash: true,
              role: true,
              tenantId: true,
            },
          },
        },
        where: {
          role: "CASHIER",
          status: "ACTIVE",
          tenant: {
            slug: tenantSlug,
            status: { in: ["ACTIVE", "TRIAL"] },
          },
          user: {
            cashierCode,
            isActive: true,
            role: "CASHIER",
          },
        },
      });

      const cashier = membership?.user;
      const storedHash = cashier?.pinHash ?? DUMMY_CASHIER_PIN_HASH;
      const verification = await verifyCashierPin(pin, storedHash);

      if (
        !membership ||
        !cashier ||
        !cashier.pinHash ||
        cashier.tenantId !== membership.tenant.id ||
        !verification.valid
      ) {
        throw new UnauthorizedException("Credenciales de cajero inválidas");
      }

      let activePinHash = cashier.pinHash;

      if (verification.needsRehash) {
        activePinHash = await hashCashierPin(pin);

        const updated = await this.prisma.user.updateMany({
          data: { pinHash: activePinHash },
          where: {
            id: cashier.id,
            isActive: true,
            pinHash: cashier.pinHash,
            role: "CASHIER",
            tenantId: membership.tenant.id,
          },
        });

        if (updated.count !== 1) {
          throw new UnauthorizedException("Credenciales de cajero inválidas");
        }
      }

      loginResult = {
        cashier: {
          id: cashier.id,
          name: cashier.name,
          pinHash: activePinHash,
          tenantId: membership.tenant.id,
          tenantSlug: membership.tenant.slug,
        },
        openingCash: this.resolveOpeningCash(membership.tenant.settings),
      };
    } catch (error) {
      if (!(error instanceof UnauthorizedException)) {
        await this.loginRateLimit.releaseAttempt(attemptContext);
      }

      throw error;
    }

    await this.loginRateLimit.registerSuccess(attemptContext);

    return loginResult;
  }

  async recordSuccessfulLogin(
    cashierId: string,
    tenantId: string
  ): Promise<void> {
    const updated = await this.prisma.user.updateMany({
      data: { lastLoginAt: new Date() },
      where: {
        id: cashierId,
        isActive: true,
        role: "CASHIER",
        tenantId,
      },
    });

    if (updated.count !== 1) {
      throw new UnauthorizedException("La cuenta del cajero ya no está activa");
    }
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

    if (
      cashier.tenant?.status !== "ACTIVE" &&
      cashier.tenant?.status !== "TRIAL"
    ) {
      throw new BadRequestException("El negocio no está activo");
    }

    const tenant = await this.prisma.tenant.findUnique({
      select: { settings: true, status: true },
      where: { id: cashier.tenantId },
    });

    if (!tenant || (tenant.status !== "ACTIVE" && tenant.status !== "TRIAL")) {
      throw new BadRequestException("El negocio no está activo");
    }

    try {
      const openShift = await this.prisma.cashierShift.findFirst({
        select: { id: true },
        where: {
          cashierId,
          status: "OPEN",
          tenantId: cashier.tenantId,
        },
      });

      if (openShift) {
        return;
      }

      await this.prisma.cashierShift.create({
        data: {
          cashierId,
          openingCash: this.resolveOpeningCash(tenant?.settings),
          tenantId: cashier.tenantId,
        },
      });
    } catch (error) {
      if (isPrismaErrorCode(error, "P2002")) {
        const concurrentShift = await this.prisma.cashierShift.findFirst({
          select: { id: true },
          where: {
            cashierId,
            status: "OPEN",
            tenantId: cashier.tenantId,
          },
        });

        if (concurrentShift) {
          return;
        }
      }

      if (isMissingPrismaTableError(error, CASHIER_SHIFTS_TABLE)) {
        this.logger.error(
          `cashier_shifts table unavailable — refusing login for cashier ${cashierId}`
        );
        throw new ServiceUnavailableException(
          "No se pudo iniciar el turno de caja"
        );
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
}
