import { randomUUID } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";
import type { Request, Response } from "express";

import {
  CASHIER_SESSION_COOKIE_NAME,
  CASHIER_SESSION_COOKIE_OPTIONS,
} from "../constants/cookie.constants";
import { PrismaService } from "../lib/prisma.service";
import type {
  SessionResult,
  SessionUser,
} from "../types/session.type";

@Injectable()
export class CashierSessionService {
  private readonly logger = new Logger(CashierSessionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validates an existing cashier session by looking up the session ID
   * in Redis and verifying the associated user still exists and is active.
   */
  async validateSession(
    sessionId: string
  ): Promise<SessionResult> {
    if (!sessionId) {
      return { authenticated: false, reason: "missing_session_id" };
    }

    // For Vercel serverless, we skip Redis and validate directly against the DB.
    // The cashier session is a simple DB-backed session.
    try {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          user: {
            select: {
              email: true,
              id: true,
              isActive: true,
              name: true,
              role: true,
              tenantId: true,
            },
          },
        },
      });

      if (!session) {
        return { authenticated: false, reason: "session_not_found" };
      }

      if (session.revokedAt) {
        return { authenticated: false, reason: "session_revoked" };
      }

      if (session.expiresAt < new Date()) {
        return { authenticated: false, reason: "session_expired" };
      }

      const { user } = session;

      if (!user.isActive) {
        return { authenticated: false, reason: "user_inactive" };
      }

      if (user.role !== "CASHIER") {
        return { authenticated: false, reason: "not_cashier" };
      }

      return {
        accessToken: "",
        authType: "cashier",
        authenticated: true,
        organizationId: user.tenantId,
        role: "CASHIER",
        sessionId,
        user: this.makeFakeWorkOSUser(user),
        userId: user.id,
      };
    } catch (error) {
      this.logger.error(`Cashier session lookup failed: ${error}`);
      return { authenticated: false, reason: "cashier_session_error" };
    }
  }

  /**
   * Validates a PIN for a cashier identified by code (+ optional tenant slug)
   * and creates a persistent session.
   */
  async loginWithPin(
    code: string,
    pin: string,
    slug: string | undefined,
    request: Request,
    response: Response
  ): Promise<SessionResult> {
    // Locate the cashier by code within the specified tenant (or any tenant
    // if the slug is omitted for single-tenant flows).
    const tenantWhere = slug ? { slug } : undefined;

    const user = await this.prisma.user.findFirst({
      select: {
        email: true,
        id: true,
        isActive: true,
        name: true,
        pinHash: true,
        role: true,
        tenantId: true,
      },
      where: {
        cashierCode: code,
        isActive: true,
        role: "CASHIER",
        ...(tenantWhere ? { tenant: tenantWhere } : {}),
      },
    });

    if (!user) {
      return { authenticated: false, reason: "invalid_credentials" };
    }

    // If the user has a bcrypt-hashed PIN, verify it.
    if (user.pinHash) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires, node/global-require, unicorn/prefer-module
        const bcrypt = require("bcrypt");
        const valid = await bcrypt.compare(pin, user.pinHash);

        if (!valid) {
          return { authenticated: false, reason: "invalid_credentials" };
        }
      } catch {
        this.logger.error("bcrypt not available for PIN verification");
        return { authenticated: false, reason: "internal_error" };
      }
    }

    // Create a persistent session for the cashier.
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    try {
      await this.prisma.session.create({
        data: {
          expiresAt,
          id: sessionId,
          ipAddress: request.ip ?? undefined,
          refreshToken: sessionId,
          userAgent: request.headers["user-agent"] ?? undefined,
          userId: user.id,
        },
      });

      await this.prisma.user.update({
        data: { lastLoginAt: new Date() },
        where: { id: user.id },
      });
    } catch (error) {
      this.logger.error(`Failed to create cashier session: ${error}`);
      return { authenticated: false, reason: "session_creation_failed" };
    }

    response.cookie(
      CASHIER_SESSION_COOKIE_NAME,
      sessionId,
      CASHIER_SESSION_COOKIE_OPTIONS
    );

    this.logger.log(`Cashier session created: user=${user.id}`);

    return {
      accessToken: "",
      authType: "cashier",
      authenticated: true,
      organizationId: user.tenantId,
      role: "CASHIER",
      sessionId,
      user: this.makeFakeWorkOSUser(user),
      userId: user.id,
    };
  }

  /**
   * Clears the cashier session cookie on the client.
   */
  clearSession(_request: Request, response: Response): void {
    response.clearCookie(
      CASHIER_SESSION_COOKIE_NAME,
      CASHIER_SESSION_COOKIE_OPTIONS
    );
  }

  /**
   * Creates a session cookie value for the given session ID.
   */
  createSessionCookieValue(sessionId: string): string {
    return sessionId;
  }

  /**
   * Revokes all active sessions for a given user.
   */
  async revokeCashierSession(userId: string): Promise<void> {
    try {
      await this.prisma.session.updateMany({
        data: { revokedAt: new Date() },
        where: { userId },
      });
      this.logger.log(`Revoked cashier sessions for userId=${userId}`);
    } catch (error) {
      this.logger.error(`Failed to revoke cashier sessions: ${error}`);
    }
  }

  // ─── Private ──────────────────────────────────────────────────────

  private makeFakeWorkOSUser(user: {
    email: string | null;
    id: string;
    name: string;
  }): SessionUser {
    return {
      email: user.email,
      emailVerified: true,
      firstName: user.name,
      id: user.id,
      lastName: null,
      name: user.name,
    };
  }
}
