import { createClient } from "redis";

import { loadRedisConfig } from "../config/redis.config";

let _client: ReturnType<typeof createClient> | undefined;

export function getRedisClient(): ReturnType<typeof createClient> {
  if (!_client) {
    const redisConfig = loadRedisConfig();

    _client = createClient({
      socket: {
        host: redisConfig.host,
        port: redisConfig.port,
      },
    });

    _client.on("error", (error) => {
      console.error("Error de Redis:", error);
    });
  }

  return _client;
}
