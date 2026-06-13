import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

const SWAGGER_PATH = "api-docs";

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle("Kiosq API")
    .setDescription("REST API documentation for the Kiosq platform")
    .setVersion("1.0")
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(SWAGGER_PATH, app, document);
}
