import type { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import { createHelmetOptions } from "./common/security/helmet.config";
import { tokenSafeCacheHeaders } from "./common/security/security-headers.middleware";

export function setupApp(app: INestApplication): void {
  app.use(helmet(createHelmetOptions()));
  app.use(tokenSafeCacheHeaders);
  app.use(cookieParser());
}
