import type { NextFunction, Request, Response } from "express";

export function tokenSafeCacheHeaders(
  _request: Request,
  response: Response,
  next: NextFunction
): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Pragma", "no-cache");
  next();
}
