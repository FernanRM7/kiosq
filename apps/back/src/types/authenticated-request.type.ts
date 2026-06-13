import type { Request } from "express";

import type { JwtPayload } from "./jwt-payload.type";

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
