import { createClient } from "redis";

import { loadRedisConfig } from "../config/redis.config";

const redisConfig = loadRedisConfig();

export const redisClient = createClient({
  socket: {
    host: redisConfig.host,
    port: redisConfig.port,
  },
});

redisClient.on("error", (error) => {
  console.error("Error de Redis:", error);
});