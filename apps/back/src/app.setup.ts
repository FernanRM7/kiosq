import type { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import { requestContextMiddleware } from "./common/middlewares/request-context.middleware";
import { createHelmetOptions } from "./common/security/helmet.config";
import {
  createCsrfOriginMiddleware,
  resolveAllowedOrigins,
} from "./common/security/origin-policy";
import { tokenSafeCacheHeaders } from "./common/security/security-headers.middleware";

export function setupApp(app: INestApplication): void {
  const allowedOrigins = resolveAllowedOrigins();

  app.use(requestContextMiddleware);
  app.use(helmet(createHelmetOptions()));
  app.use(tokenSafeCacheHeaders);
  app.use(cookieParser());
  app.use(createCsrfOriginMiddleware(allowedOrigins));

  app.enableCors({
    credentials: true,
    origin: allowedOrigins,
  });
}
