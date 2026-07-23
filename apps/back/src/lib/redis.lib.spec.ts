jest.mock("redis", () => ({
  createClient: jest.fn(),
}));
jest.mock("../config/redis.config", () => ({
  loadRedisConfig: jest.fn(() => ({
    host: "redis.internal",
    password: "secret",
    port: 6379,
  })),
}));

import { describe, expect, it, jest } from "@jest/globals";
import { createClient } from "redis";

import { getRedisClient } from "./redis.lib";

describe("Redis client", () => {
  it("fails commands quickly instead of queuing security decisions offline", () => {
    const client = {
      on: jest.fn(),
    };
    jest.mocked(createClient).mockReturnValueOnce(client as never);

    expect(getRedisClient()).toBe(client);
    expect(createClient).toHaveBeenCalledWith({
      commandOptions: {
        timeout: 5_000,
      },
      commandsQueueMaxLength: 256,
      disableOfflineQueue: true,
      password: "secret",
      socket: {
        connectTimeout: 5_000,
        host: "redis.internal",
        port: 6379,
      },
    });
  });
});
