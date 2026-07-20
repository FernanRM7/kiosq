import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";

import { AppModule } from "./app.module";
import { setupApp } from "./app.setup";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
// Swagger UI is intentionally disabled during build to avoid runtime
// incompatibilities between @nestjs/swagger and the installed @nestjs/core.
// If you want Swagger enabled, re-enable and align package versions.
import { logger } from "./lib/logger";
import { getRedisClient } from "./lib/redis.lib";

// ─── Bootstrap ────────────────────────────────────────────────────────────────

let _cachedApp: INestApplication;

async function bootstrap(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, {
    // rawBody is required for WorkOS webhook signature verification.
    // WebhookController reads request.rawBody to compute the HMAC.
    bufferLogs: true,
    rawBody: true,
  });

  app.use(helmet());
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
    void (async () => {
      try {
        await redisClient.connect();
      } catch (redisError) {
        logger.warn(
          { error: redisError },
          "Redis no disponible — sesiones activas no disponibles"
        );
      }
    })();
  } catch (redisError) {
    logger.warn(
      { error: redisError },
      "Redis no disponible — sesiones activas no disponibles"
    );
  }

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
    // Swagger UI is disabled in this build.
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
