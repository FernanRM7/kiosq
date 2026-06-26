import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";

import { AppModule } from "./app.module";
import { setupApp } from "./app.setup";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { SWAGGER_PATH, setupSwagger } from "./docs/swagger.config";
import { logger } from "./lib/logger";
import { getRedisClient } from "./lib/redis.lib";

// ─── Bootstrap ────────────────────────────────────────────────────────────────

let _cachedApp: INestApplication;

async function bootstrap(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, {
    // rawBody is required for WorkOS webhook signature verification.
    // WebhookController reads request.rawBody to compute the HMAC.
    rawBody: true,
  });

  app.use(helmet());
  app.useGlobalFilters(new GlobalExceptionFilter());
  setupApp(app);

  const apiPrefix = process.env.API_PREFIX;

  if (apiPrefix) {
    app.setGlobalPrefix(apiPrefix);
  }

  setupSwagger(app);

  try {
    await getRedisClient().connect();
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
