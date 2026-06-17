export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
}

export function loadRedisConfig(): RedisConfig {
  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT;
  const password = process.env.REDIS_PASSWORD;

  if (!host) {
    throw new Error("Falta la variable de entorno requerida: REDIS_HOST");
  }

  if (!port) {
    throw new Error("Falta la variable de entorno requerida: REDIS_PORT");
  }

  return {
    host,
    password: password || undefined,
    port: Number(port),
  };
}
