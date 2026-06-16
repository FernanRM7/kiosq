export interface RedisConfig {
  host: string;
  port: number;
}

export function loadRedisConfig(): RedisConfig {
  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT;

  if (!host) {
    throw new Error("Falta la variable de entorno requerida: REDIS_HOST");
  }

  if (!port) {
    throw new Error("Falta la variable de entorno requerida: REDIS_PORT");
  }

  return {
    host,
    port: Number(port),
  };
}
