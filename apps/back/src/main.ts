import "./prisma-setup";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { setupApp } from "./app.setup";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { SWAGGER_PATH, setupSwagger } from "./docs/swagger.config";
import { logger } from "./lib/logger";
import { getRedisClient } from "./lib/redis.lib";

// ─── Bootstrap ────────────────────────────────────────────────────────────────

let _cachedApp: INestApplication;

async function connectRedisInBackground(
  redisClient: ReturnType<typeof getRedisClient>
): Promise<void> {
  try {
    await redisClient.connect();
  } catch (redisError) {
    logger.warn(
      { error: redisError },
      "Redis no disponible — el acceso de cajeros permanecerá cerrado"
    );
  }
}

async function bootstrap(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, {
    // rawBody is required for WorkOS webhook signature verification.
    // WebhookController reads request.rawBody to compute the HMAC.
    bufferLogs: true,
    rawBody: true,
  });

  app.useGlobalFilters(new GlobalExceptionFilter());
  setupApp(app);

  const apiPrefix = process.env.API_PREFIX;
  if (apiPrefix) {
    try {
      app.setGlobalPrefix(apiPrefix);
    } catch (error) {
      // Some Nest versions or mismatched packages may export internals
      // differently (e.g., shared_utils.validatePath). Don't block
      // application startup for an invalid prefix — log and continue.
      // eslint-disable-next-line no-console
      console.warn(
        "Failed to set global API prefix:",
        error instanceof Error ? error.message : error
      );
    }
  }

  try {
    const redisClient = getRedisClient();

    if (!redisClient.isOpen) {
      void connectRedisInBackground(redisClient);
    }
  } catch (redisError) {
    logger.warn(
      { error: redisError },
      "Redis no disponible — el acceso de cajeros permanecerá cerrado"
    );
  }

  setupSwagger(app);

  await app.init();

  _cachedApp = app;
  return app;
}

// ─── Local Development ────────────────────────────────────────────────────────

if (!process.env.VERCEL) {
  (async () => {
    const app = await bootstrap();
    await app.listen(process.env.PORT ?? 3000);

    const port = process.env.PORT ?? 3000;
    logger.info(`Backend iniciado correctamente en el puerto ${port}`);
    logger.info(`Swagger UI: http://localhost:${port}/${SWAGGER_PATH}`);
    logger.info(`OpenAPI JSON: http://localhost:${port}/${SWAGGER_PATH}-json`);
  })();
}

// ─── Vercel Serverless Handler ────────────────────────────────────────────────

async function handler(req: unknown, res: unknown): Promise<void> {
  if (!_cachedApp) {
    _cachedApp = await bootstrap();
  }

  _cachedApp.getHttpAdapter().getInstance()(req, res);
}

export default handler;
