import type { RequestHandler } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function normalizeOrigin(value: string): string {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Origen no válido en la configuración: ${value}`);
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(`Origen no permitido en la configuración: ${value}`);
  }

  return parsed.origin;
}

export function resolveAllowedOrigins(): string[] {
  const configured =
    process.env.CORS_ORIGIN ?? process.env.APP_URL ?? "http://localhost:5173";
  const origins = configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(normalizeOrigin);

  if (origins.length === 0) {
    throw new Error("CORS_ORIGIN debe incluir al menos un origen");
  }

  return [...new Set(origins)];
}

export function createCsrfOriginMiddleware(
  allowedOrigins: readonly string[],
  apiPrefix = process.env.API_PREFIX
): RequestHandler {
  const allowed = new Set(allowedOrigins.map(normalizeOrigin));
  const normalizedPrefix = apiPrefix?.replaceAll(/^\/+|\/+$/gu, "");
  const webhookPaths = new Set([
    "/webhooks/workos",
    ...(normalizedPrefix ? [`/${normalizedPrefix}/webhooks/workos`] : []),
  ]);

  return (request, response, next) => {
    const path = request.originalUrl.split("?")[0] ?? request.path;

    if (
      SAFE_METHODS.has(request.method.toUpperCase()) ||
      webhookPaths.has(path)
    ) {
      next();
      return;
    }

    const origin = request.get("origin");
    let normalizedOrigin: string | undefined;

    if (origin && origin !== "null") {
      try {
        normalizedOrigin = normalizeOrigin(origin);
      } catch {
        normalizedOrigin = undefined;
      }
    }

    if (!normalizedOrigin || !allowed.has(normalizedOrigin)) {
      response.status(403).json({
        error: {
          code: "CSRF_ORIGIN_DENIED",
          message: "El origen de la solicitud no está permitido",
          path,
          statusCode: 403,
        },
        success: false,
      });
      return;
    }

    next();
  };
}
