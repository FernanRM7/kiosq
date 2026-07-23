import { createHash, randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

import { CASHIER_SESSION_TTL_SECONDS } from "../constants/cookie.constants";
import { PrismaService } from "../lib/prisma.service";
import { getRedisClient } from "../lib/redis.lib";
import { CashierLoginRateLimitService } from "./cashier-login-rate-limit.service";
import { CashierSessionService } from "./cashier-session.service";

const integrationDescribe =
  process.env.RUN_REDIS_INTEGRATION === "1" ? describe : describe.skip;

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

integrationDescribe("cashier auth with real Redis", () => {
  const keysToDelete = new Set<string>();
  const rateLimit = new CashierLoginRateLimitService();
  let redis: ReturnType<typeof getRedisClient>;

  beforeAll(async () => {
    redis = getRedisClient();
    if (!redis.isOpen) {
      await redis.connect();
    }
  });

  afterAll(async () => {
    if (keysToDelete.size > 0 && redis.isReady) {
      await redis.del([...keysToDelete]);
    }
    if (redis.isOpen) {
      redis.destroy();
    }
  });

  it("allows only five concurrent bcrypt reservations per identity", async () => {
    const suffix = randomUUID();
    const context = {
      cashierCode: `CJ-${suffix}`,
      clientAddress: `identity-test-${suffix}`,
      tenantSlug: `tenant-${suffix}`,
    };
    keysToDelete.add(
      `cashier_login_attempt:identity:${digest(
        `${context.tenantSlug.toLowerCase()}\0${context.cashierCode.toUpperCase()}`
      )}`
    );
    keysToDelete.add(
      `cashier_login_attempt:ip:${digest(context.clientAddress)}`
    );

    const results = await Promise.allSettled(
      Array.from({ length: 50 }, () => rateLimit.consumeAttempt(context))
    );
    const allowed = results.filter((result) => result.status === "fulfilled");
    const denied = results.filter(
      (result) =>
        result.status === "rejected" &&
        (result.reason as { status?: number }).status === 429
    );

    expect(allowed).toHaveLength(5);
    expect(denied).toHaveLength(45);
  });

  it("allows only thirty concurrent reservations behind one IP", async () => {
    const suffix = randomUUID();
    const clientAddress = `ip-test-${suffix}`;
    const contexts = Array.from({ length: 50 }, (_, index) => ({
      cashierCode: `CJ-${index}-${suffix}`,
      clientAddress,
      tenantSlug: `tenant-${index}-${suffix}`,
    }));

    keysToDelete.add(`cashier_login_attempt:ip:${digest(clientAddress)}`);
    for (const context of contexts) {
      keysToDelete.add(
        `cashier_login_attempt:identity:${digest(
          `${context.tenantSlug.toLowerCase()}\0${context.cashierCode.toUpperCase()}`
        )}`
      );
    }

    const results = await Promise.allSettled(
      contexts.map((context) => rateLimit.consumeAttempt(context))
    );
    const allowed = results.filter((result) => result.status === "fulfilled");
    const denied = results.filter(
      (result) =>
        result.status === "rejected" &&
        (result.reason as { status?: number }).status === 429
    );

    expect(allowed).toHaveLength(30);
    expect(denied).toHaveLength(20);
  });

  it("stores cashier sessions with the fixed server-side TTL", async () => {
    const userId = `cashier-${randomUUID()}`;
    const sessions = new CashierSessionService({} as PrismaService);
    const sessionId = await sessions.createSession({
      pinHash: "$2b$12$xTCmIfFNp//uSMmaSMH32O1GxwofldSe0y/R4mMO7OM0AF5/1fCLu",
      tenantId: "tenant-integration",
      userId,
    });
    const sessionKey = `cashier_session:${sessionId}`;
    const indexKey = `cashier_user_sessions:${userId}`;
    keysToDelete.add(sessionKey);
    keysToDelete.add(indexKey);

    const ttl = await redis.ttl(sessionKey);

    expect(ttl).toBeGreaterThan(CASHIER_SESSION_TTL_SECONDS - 5);
    expect(ttl).toBeLessThanOrEqual(CASHIER_SESSION_TTL_SECONDS);
  });
});
