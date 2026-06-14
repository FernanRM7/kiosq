import type { Request } from "express";

import type { JwtPayload } from "./jwt-payload.type";
import type { AuthenticatedSessionResult } from "./session.type";

/** Request with Bearer JWT payload injected by a JWT Guard */
export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

/** Request with sealed session result injected by AuthGuard */
export interface SessionRequest extends Request {
  user: AuthenticatedSessionResult;
}
