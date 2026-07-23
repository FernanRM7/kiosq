jest.mock("../lib/redis.lib", () => ({
  getRedisClient: jest.fn(),
}));

import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import {
  CASHIER_SESSION_COOKIE_NAME,
  CASHIER_SESSION_TTL_SECONDS,
} from "../constants/cookie.constants";
import { PrismaService } from "../lib/prisma.service";
import { getRedisClient } from "../lib/redis.lib";
import { CashierSessionService } from "./cashier-session.service";

const SESSION_ID = "s".repeat(43);
const PIN_HASH = "$2b$12$xTCmIfFNp//uSMmaSMH32O1GxwofldSe0y/R4mMO7OM0AF5/1fCLu";

function validMembership() {
  return {
    role: "CASHIER",
    status: "ACTIVE",
    tenant: { status: "ACTIVE" },
    user: {
      email: null,
      id: "cashier-1",
      isActive: true,
      name: "Caja Uno",
      pinHash: PIN_HASH,
      role: "CASHIER",
      tenantId: "tenant-1",
    },
  };
}

function validPayload(createdAt = new Date().toISOString()) {
  return JSON.stringify({
    createdAt,
    credentialFingerprint: createHash("sha256")
      .update(PIN_HASH)
      .digest("base64url"),
    tenantId: "tenant-1",
    userId: "cashier-1",
  });
}

describe("CashierSessionService", () => {
  const redis = {
    del: jest
      .fn<(...args: unknown[]) => Promise<number>>()
      .mockResolvedValue(1),
    eval: jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue(1),
    get: jest.fn<(...args: unknown[]) => Promise<string | null>>(),
  };
  const prisma = {
    userTenant: {
      findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
  };
  const response = {
    clearCookie: jest.fn(),
    cookie: jest.fn(),
  };
  let service: CashierSessionService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getRedisClient).mockReturnValue(redis as never);
    service = new CashierSessionService(prisma as unknown as PrismaService);
  });

  it("rejects legacy or forged cookie formats before querying Redis", async () => {
    const result = await service.authenticateCashierSession(
      {
        cookies: {
          [CASHIER_SESSION_COOKIE_NAME]: "eyJ1c2VySWQiOiJjYXNoaWVyLTEifQ",
        },
      } as never,
      response as never
    );

    expect(result).toStrictEqual({
      authenticated: false,
      reason: "cashier_session_invalid",
    });
    expect(redis.get).not.toHaveBeenCalled();
    expect(response.clearCookie).toHaveBeenCalled();
  });

  it("authenticates only a Redis-backed active cashier without extending its TTL", async () => {
    redis.get.mockResolvedValueOnce(validPayload());
    prisma.userTenant.findUnique.mockResolvedValueOnce(validMembership());

    const result = await service.authenticateCashierSession(
      {
        cookies: { [CASHIER_SESSION_COOKIE_NAME]: SESSION_ID },
      } as never,
      response as never
    );

    expect(result.authenticated).toBe(true);
    if (result.authenticated) {
      expect(result.authType).toBe("cashier");
      expect(result.sessionId).toBe(SESSION_ID);
      expect(result.tenantId).toBe("tenant-1");
      expect(result.userId).toBe("cashier-1");
    }
    expect(redis.eval).not.toHaveBeenCalled();
  });

  it("fails closed without deleting a valid cookie when Redis is unavailable", async () => {
    redis.get.mockRejectedValueOnce(new Error("Redis unavailable"));

    const result = await service.authenticateCashierSession(
      {
        cookies: { [CASHIER_SESSION_COOKIE_NAME]: SESSION_ID },
      } as never,
      response as never
    );

    expect(result).toStrictEqual({
      authenticated: false,
      reason: "cashier_session_unavailable",
    });
    expect(prisma.userTenant.findUnique).not.toHaveBeenCalled();
    expect(response.clearCookie).not.toHaveBeenCalled();
  });

  it("rejects and revokes an absolute-TTL session even when Redis returns it", async () => {
    const expiredAt = new Date(
      Date.now() - CASHIER_SESSION_TTL_SECONDS * 1000 - 1
    ).toISOString();
    redis.get.mockResolvedValueOnce(validPayload(expiredAt));

    const result = await service.authenticateCashierSession(
      {
        cookies: { [CASHIER_SESSION_COOKIE_NAME]: SESSION_ID },
      } as never,
      response as never
    );

    expect(result).toStrictEqual({
      authenticated: false,
      reason: "cashier_session_expired",
    });
    expect(prisma.userTenant.findUnique).not.toHaveBeenCalled();
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("SREM", KEYS[2], ARGV[1])'),
      expect.objectContaining({
        arguments: [SESSION_ID],
      })
    );
    expect(response.clearCookie).toHaveBeenCalled();
  });

  it("revokes a session when the membership is disabled", async () => {
    redis.get.mockResolvedValueOnce(validPayload());
    prisma.userTenant.findUnique.mockResolvedValueOnce({
      ...validMembership(),
      status: "DISABLED",
    });

    const result = await service.authenticateCashierSession(
      {
        cookies: { [CASHIER_SESSION_COOKIE_NAME]: SESSION_ID },
      } as never,
      response as never
    );

    expect(result).toStrictEqual({
      authenticated: false,
      reason: "cashier_session_revoked",
    });
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("DEL", KEYS[1])'),
      expect.objectContaining({
        keys: [
          `cashier_session:${SESSION_ID}`,
          "cashier_user_sessions:cashier-1",
        ],
      })
    );
    expect(response.clearCookie).toHaveBeenCalled();
  });

  it("creates an opaque session and both indexes atomically with an absolute TTL", async () => {
    const sessionId = await service.createSession({
      pinHash: PIN_HASH,
      tenantId: "tenant-1",
      userId: "cashier-1",
    });

    expect(sessionId).toMatch(/^[\w-]{43}$/u);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("SET", KEYS[1]'),
      {
        arguments: [
          expect.any(String),
          sessionId,
          String(CASHIER_SESSION_TTL_SECONDS),
        ],
        keys: [
          `cashier_session:${sessionId}`,
          "cashier_user_sessions:cashier-1",
        ],
      }
    );
  });

  it("revokes all user sessions through the index without KEYS or MULTI", async () => {
    await service.revokeCashierSession("cashier-1");

    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("SMEMBERS", KEYS[1])'),
      {
        arguments: ["cashier_session:"],
        keys: ["cashier_user_sessions:cashier-1"],
      }
    );
  });
});
