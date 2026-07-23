import { pbkdf2Sync, randomBytes } from "node:crypto";

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  HttpException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";

import { hashCashierPin } from "../lib/cashier-pin";
import { PrismaService } from "../lib/prisma.service";
import { CashierLoginRateLimitService } from "./cashier-login-rate-limit.service";
import { CashierService } from "./cashier.service";

function activeMembership(pinHash: string) {
  return {
    role: "CASHIER",
    status: "ACTIVE",
    tenant: {
      id: "tenant-1",
      settings: { cashOpeningAmount: 700 },
      slug: "mi-tienda",
      status: "ACTIVE",
    },
    user: {
      cashierCode: "CJ-123456",
      id: "cashier-1",
      isActive: true,
      name: "Caja Uno",
      pinHash,
      role: "CASHIER",
      tenantId: "tenant-1",
    },
  };
}

describe("CashierService authentication", () => {
  const prisma = {
    cashierShift: {
      create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findFirst: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    tenant: {
      findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    user: {
      findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      updateMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    userTenant: {
      findFirst: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
  };
  const loginRateLimit = {
    consumeAttempt: jest.fn<(...args: unknown[]) => Promise<void>>(),
    registerSuccess: jest.fn<(...args: unknown[]) => Promise<void>>(),
    releaseAttempt: jest.fn<(...args: unknown[]) => Promise<void>>(),
  };
  let service: CashierService;

  beforeEach(() => {
    jest.clearAllMocks();
    loginRateLimit.consumeAttempt.mockResolvedValue(undefined);
    loginRateLimit.registerSuccess.mockResolvedValue(undefined);
    loginRateLimit.releaseAttempt.mockResolvedValue(undefined);
    service = new CashierService(
      prisma as unknown as PrismaService,
      loginRateLimit as unknown as CashierLoginRateLimitService
    );
  });

  it("normalizes the workspace and cashier code and accepts bcrypt", async () => {
    const pinHash = await hashCashierPin("123456");
    prisma.userTenant.findFirst.mockResolvedValueOnce(
      activeMembership(pinHash)
    );

    const result = await service.authenticateCashierLogin(
      {
        cashierCode: "cj-123456",
        pin: "123456",
        tenantSlug: "MI-TIENDA",
      },
      "203.0.113.10"
    );

    expect(prisma.userTenant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenant: expect.objectContaining({ slug: "mi-tienda" }),
          user: expect.objectContaining({
            cashierCode: "CJ-123456",
          }),
        }),
      })
    );
    expect(result.cashier.pinHash).toBe(pinHash);
    expect(result.openingCash).toBe(700);
    expect(loginRateLimit.registerSuccess).toHaveBeenCalled();
  });

  it("migrates a valid legacy PBKDF2 PIN to bcrypt", async () => {
    const salt = randomBytes(16).toString("hex");
    const expected = pbkdf2Sync("123456", salt, 100_000, 64, "sha256").toString(
      "hex"
    );
    const legacyHash = `pbkdf2$100000$${salt}$${expected}`;
    prisma.userTenant.findFirst.mockResolvedValueOnce(
      activeMembership(legacyHash)
    );
    prisma.user.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await service.authenticateCashierLogin(
      {
        cashierCode: "CJ-123456",
        pin: "123456",
        tenantSlug: "mi-tienda",
      },
      "203.0.113.10"
    );

    expect(result.cashier.pinHash.startsWith("$2")).toBe(true);
    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pinHash: expect.stringMatching(/^\$2/u),
        }),
        where: expect.objectContaining({ pinHash: legacyHash }),
      })
    );
  });

  it("returns the same error and keeps the atomic reservation for an unknown cashier", async () => {
    prisma.userTenant.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.authenticateCashierLogin(
        {
          cashierCode: "CJ-000000",
          pin: "123456",
          tenantSlug: "mi-tienda",
        },
        "203.0.113.10"
      )
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(loginRateLimit.consumeAttempt).toHaveBeenCalled();
    expect(loginRateLimit.registerSuccess).not.toHaveBeenCalled();
    expect(loginRateLimit.releaseAttempt).not.toHaveBeenCalled();
  });

  it("releases its reservation when Prisma fails before credentials are decided", async () => {
    prisma.userTenant.findFirst.mockRejectedValueOnce(
      new Error("database unavailable")
    );

    await expect(
      service.authenticateCashierLogin(
        {
          cashierCode: "CJ-123456",
          pin: "123456",
          tenantSlug: "mi-tienda",
        },
        "203.0.113.10"
      )
    ).rejects.toThrow("database unavailable");

    expect(loginRateLimit.releaseAttempt).toHaveBeenCalled();
    expect(loginRateLimit.registerSuccess).not.toHaveBeenCalled();
  });

  it("checks the atomic limit before querying Prisma or running bcrypt", async () => {
    loginRateLimit.consumeAttempt.mockRejectedValueOnce(
      new HttpException("too many", 429)
    );

    await expect(
      service.authenticateCashierLogin(
        {
          cashierCode: "CJ-123456",
          pin: "123456",
          tenantSlug: "mi-tienda",
        },
        "203.0.113.10"
      )
    ).rejects.toMatchObject({ status: 429 });

    expect(prisma.userTenant.findFirst).not.toHaveBeenCalled();
  });

  it("does not create a second open shift for the same cashier", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      tenant: { status: "ACTIVE" },
      tenantId: "tenant-1",
    });
    prisma.tenant.findUnique.mockResolvedValueOnce({
      settings: {},
      status: "ACTIVE",
    });
    prisma.cashierShift.findFirst.mockResolvedValueOnce({ id: "shift-1" });

    await service.openCashierShift("cashier-1");

    expect(prisma.cashierShift.create).not.toHaveBeenCalled();
  });

  it("treats a unique conflict as a concurrent successful shift open", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      tenant: { status: "ACTIVE" },
      tenantId: "tenant-1",
    });
    prisma.tenant.findUnique.mockResolvedValueOnce({
      settings: {},
      status: "ACTIVE",
    });
    prisma.cashierShift.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "shift-concurrent" });
    prisma.cashierShift.create.mockRejectedValueOnce({ code: "P2002" });

    await expect(
      service.openCashierShift("cashier-1")
    ).resolves.toBeUndefined();
    expect(prisma.cashierShift.findFirst).toHaveBeenCalledTimes(2);
  });

  it("does not hide a unique conflict without a concurrent open shift", async () => {
    const uniqueError = { code: "P2002" };
    prisma.user.findUnique.mockResolvedValueOnce({
      tenant: { status: "ACTIVE" },
      tenantId: "tenant-1",
    });
    prisma.tenant.findUnique.mockResolvedValueOnce({
      settings: {},
      status: "ACTIVE",
    });
    prisma.cashierShift.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prisma.cashierShift.create.mockRejectedValueOnce(uniqueError);

    await expect(service.openCashierShift("cashier-1")).rejects.toBe(
      uniqueError
    );
  });

  it("fails closed when the required shifts table is missing", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      tenant: { status: "ACTIVE" },
      tenantId: "tenant-1",
    });
    prisma.tenant.findUnique.mockResolvedValueOnce({
      settings: {},
      status: "ACTIVE",
    });
    prisma.cashierShift.findFirst.mockRejectedValueOnce({
      code: "P2021",
      meta: { table: "public.cashier_shifts" },
    });

    await expect(service.openCashierShift("cashier-1")).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it("records lastLoginAt only after the controller finishes login setup", async () => {
    prisma.user.updateMany.mockResolvedValueOnce({ count: 1 });

    await service.recordSuccessfulLogin("cashier-1", "tenant-1");

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      data: { lastLoginAt: expect.any(Date) },
      where: {
        id: "cashier-1",
        isActive: true,
        role: "CASHIER",
        tenantId: "tenant-1",
      },
    });
  });
});
