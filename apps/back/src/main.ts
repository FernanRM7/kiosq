import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { SWAGGER_PATH, setupSwagger } from "./common/swagger/swagger.config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  setupSwagger(app);

  await app.listen(process.env.PORT ?? 3000);

  const port = process.env.PORT ?? 3000;
  console.log(`Swagger UI → http://localhost:${port}/${SWAGGER_PATH}`);
  console.log(`OpenAPI JSON → http://localhost:${port}/${SWAGGER_PATH}-json`);
}
bootstrap();
