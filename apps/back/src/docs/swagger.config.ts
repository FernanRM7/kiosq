import type { INestApplication } from "@nestjs/common";

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

interface SwaggerModuleLike {
  createDocument: (app: INestApplication, config: unknown) => unknown;
  setup: (
    path: string,
    app: INestApplication,
    document: unknown,
    options?: Record<string, unknown>
  ) => void;
}

interface DocumentBuilderLike {
  addBearerAuth: (
    options: Record<string, string>,
    name: string
  ) => DocumentBuilderLike;
  addCookieAuth: (
    name: string,
    options: Record<string, string>
  ) => DocumentBuilderLike;
  build: () => unknown;
  setDescription: (description: string) => DocumentBuilderLike;
  setTitle: (title: string) => DocumentBuilderLike;
  setVersion: (version: string) => DocumentBuilderLike;
}

type DocumentBuilderCtor = new () => DocumentBuilderLike;

export function setupSwagger(app: INestApplication): void {
  let swaggerModuleRuntime: SwaggerModuleLike | undefined;
  let documentBuilderRuntime: DocumentBuilderCtor | undefined;

  try {
    // Load @nestjs/swagger at runtime so that incompatible @nestjs/*
    // versions do not break the build. If the package or internal APIs
    // are missing, skip Swagger setup gracefully.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, node/global-require, unicorn/prefer-module
    const swaggerPkg = require("@nestjs/swagger") as {
      DocumentBuilder?: DocumentBuilderCtor;
      SwaggerModule?: SwaggerModuleLike;
      default?: {
        DocumentBuilder?: DocumentBuilderCtor;
        SwaggerModule?: SwaggerModuleLike;
      };
    };
    swaggerModuleRuntime =
      swaggerPkg.SwaggerModule ?? swaggerPkg.default?.SwaggerModule;
    documentBuilderRuntime =
      swaggerPkg.DocumentBuilder ?? swaggerPkg.default?.DocumentBuilder;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      "Swagger setup skipped: @nestjs/swagger not available or incompatible",
      error instanceof Error ? error.message : error
    );
    return;
  }

  if (!swaggerModuleRuntime || !documentBuilderRuntime) {
    return;
  }

  const config = new documentBuilderRuntime()
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

  let document: unknown;
  try {
    document = swaggerModuleRuntime.createDocument(app, config);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      "Swagger setup skipped: failed to create document",
      error instanceof Error ? error.message : error
    );
    return;
  }

  swaggerModuleRuntime.setup(SWAGGER_PATH, app, document, {
    customSiteTitle: "Kiosq API Docs",
    explorer: "false",
  });
}
