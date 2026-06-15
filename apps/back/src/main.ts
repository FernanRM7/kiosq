import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { setupApp } from "./app.setup";
import { SWAGGER_PATH, setupSwagger } from "./docs/swagger.config";
import { logger } from "./lib/logger";
import { redisClient } from "./lib/redis.lib";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // rawBody is required for WorkOS webhook signature verification.
    // WebhookController reads request.rawBody to compute the HMAC.
    rawBody: true,
  });

  setupApp(app);

  setupSwagger(app);

  await redisClient.connect();

  await app.listen(process.env.PORT ?? 3000);

  logger.info("Backend iniciado correctamente");

  const port = process.env.PORT ?? 3000;
  logger.info(`Swagger UI: http://localhost:${port}/${SWAGGER_PATH}`);
  logger.info(`OpenAPI JSON: http://localhost:${port}/${SWAGGER_PATH}-json`);
}
bootstrap();
