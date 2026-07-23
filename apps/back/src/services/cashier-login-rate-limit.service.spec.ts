jest.mock("../lib/redis.lib", () => ({
  getRedisClient: jest.fn(),
}));

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ServiceUnavailableException } from "@nestjs/common";

import { getRedisClient } from "../lib/redis.lib";
import { CashierLoginRateLimitService } from "./cashier-login-rate-limit.service";

describe("CashierLoginRateLimitService", () => {
  const redis = {
    eval: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  };
  const context = {
    cashierCode: "CJ-123456",
    clientAddress: "203.0.113.10",
    tenantSlug: "mi-tienda",
  };
  let service: CashierLoginRateLimitService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getRedisClient).mockReturnValue(redis as never);
    service = new CashierLoginRateLimitService();
  });

  it("atomically reserves an attempt below both limits", async () => {
    redis.eval.mockResolvedValueOnce([1, 5, 29]);

    await expect(service.consumeAttempt(context)).resolves.toBeUndefined();

    expect(redis.eval).toHaveBeenCalledTimes(1);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("INCR", KEYS[1])'),
      expect.objectContaining({
        arguments: ["900", "5", "30"],
        keys: [expect.any(String), expect.any(String)],
      })
    );
  });

  it("returns HTTP 429 without a separate read when the atomic script denies", async () => {
    redis.eval.mockResolvedValueOnce([0, 5, 7]);

    await expect(service.consumeAttempt(context)).rejects.toMatchObject({
      status: 429,
    });
    expect(redis.eval).toHaveBeenCalledTimes(1);
  });

  it("fails closed when Redis cannot enforce the limit", async () => {
    redis.eval.mockRejectedValueOnce(new Error("Redis unavailable"));

    await expect(service.consumeAttempt(context)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it("fails closed on a malformed Redis response", async () => {
    redis.eval.mockResolvedValueOnce(["unexpected"]);

    await expect(service.consumeAttempt(context)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it("clears identity failures and releases only the successful IP reservation", async () => {
    redis.eval.mockResolvedValueOnce(1);

    await service.registerSuccess(context);

    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("DEL", KEYS[1])'),
      expect.objectContaining({
        keys: [expect.any(String), expect.any(String)],
      })
    );
  });

  it("does not mask an application error when releasing its reservation fails", async () => {
    redis.eval.mockRejectedValueOnce(new Error("Redis unavailable"));

    await expect(service.releaseAttempt(context)).resolves.toBeUndefined();
  });
});
