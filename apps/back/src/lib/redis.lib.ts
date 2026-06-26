import { Logger } from "@nestjs/common";
import { createClient } from "redis";

import { loadRedisConfig } from "../config/redis.config";

const logger = new Logger("Redis");

let _client: ReturnType<typeof createClient> | undefined;

export function getRedisClient(): ReturnType<typeof createClient> {
  if (!_client) {
    const redisConfig = loadRedisConfig();

    _client = createClient({
      password: redisConfig.password,
      socket: {
        host: redisConfig.host,
        port: redisConfig.port,
      },
    });

    _client.on("connect", () => {
      logger.log("Redis conectado exitosamente");
    });

    _client.on("error", (error) => {
      logger.error("Error de Redis", error);
    });
  }

  return _client;
}
