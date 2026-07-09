import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export const SWAGGER_PATH = "api-docs";

const DESCRIPTION = `
REST API documentation for the Kiosq platform.

## Authentication

This API uses **WorkOS AuthKit** for authentication via [Sealed Sessions](https://workos.com/docs/user-management/sessions).

### Session Cookie (\`wos-session\`)
Authenticated routes require a valid \`wos-session\` HttpOnly cookie issued by WorkOS.
The cookie contains an encrypted sealed session with the access token and refresh token.

### Automatic Token Rotation
> **Note:** There is no \`/rotate_token\` endpoint.
> WorkOS AuthKit handles token rotation automatically:
> when an access token expires, the API transparently calls \`session.refresh()\`,
> which rotates the refresh token on the WorkOS side and writes a new \`wos-session\`
> cookie to the response — all within the same request cycle.

### Access Token (Bearer)
The WorkOS access token (RS256 JWT) is also accepted via \`Authorization: Bearer <token>\`
for scenarios where cookie-based sessions are not available (e.g., mobile, CLI tools).
`.trim();

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle("Kiosq API")
    .setDescription(DESCRIPTION)
    .setVersion("1.0")
    .addCookieAuth("wos-session", {
      description:
        "WorkOS sealed session cookie. Contains encrypted access + refresh tokens. Rotated automatically by WorkOS AuthKit.",
      in: "cookie",
      name: "wos-session",
      type: "apiKey",
    })
    .addBearerAuth(
      {
        bearerFormat: "JWT",
        description:
          "WorkOS access token (RS256 JWT). Obtained after authentication. Short-lived — rotation is handled automatically by sealed sessions.",
        scheme: "bearer",
        type: "http",
      },
      "access-token"
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    customSiteTitle: "Kiosq API Docs",
    explorer: false,
  });
}
