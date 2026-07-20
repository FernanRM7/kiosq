import type { NextFunction, Request, Response } from "express";

import {
  generateCorrelationId,
  runCorrelationContext,
} from "../../lib/request-context";

export function requestContextMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const correlationId =
    (req.headers["x-request-id"] as string) || generateCorrelationId();
  runCorrelationContext(correlationId, next);
}
