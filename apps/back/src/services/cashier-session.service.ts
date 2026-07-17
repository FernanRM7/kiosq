import { Injectable } from "@nestjs/common";
import type { Request, Response } from "express";

import type { SessionResult } from "../types/session.type";

/**
 * Placeholder for cashier session authentication.
 *
 * This stub always returns unauthenticated. The real implementation
 * will be wired in T5 — Cashier login con PIN.
 */
@Injectable()
export class CashierSessionService {
  async authenticateCashierSession(
    _request: Request,
    _response: Response,
  ): Promise<SessionResult> {
    return {
      authenticated: false,
      reason: "cashier_auth_not_implemented",
    };
  }
}
