import { Injectable, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import * as bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";

import {
  CASHIER_SESSION_COOKIE_NAME,
  CASHIER_SESSION_COOKIE_OPTIONS,
} from "../constants/cookie.constants";
import { getRedisClient } from "../lib/redis.lib";
import { PrismaService } from "../lib/prisma.service";
import type { SessionResult } from "../types/session.type";

const CASHIER_SESSION_REDIS_PREFIX = "cashier_session:";

interface CashierSessionPayload {
  userId: string;
  tenantId: string;
}

@Injectable()
export class CashierSessionService {
  private readonly logger = new Logger(CashierSessionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Authenticates a cashier by email/name identifier and PIN.
   *
   * 1. Resolves the user by id from the request body.
   * 2. Verifies the PIN with bcrypt.compare.
   * 3. Checks that the UserTenant membership is ACTIVE.
   * 4. If all checks pass, creates a Redis-backed session and sets the cookie.
   */
  private makeFakeWorkOSUser(dbUser: {
    id: string;
    email: string | null;
    name: string;
  }): import("@workos-inc/node").User {
    const now = new Date().toISOString();
    return {
      object: "user",
      id: dbUser.id,
      email: dbUser.email ?? `${dbUser.id}@cashier.local`,
      emailVerified: false,
      profilePictureUrl: null,
      name: dbUser.name,
      firstName: dbUser.name,
      lastName: null,
      lastSignInAt: null,
      locale: null,
      createdAt: now,
      updatedAt: now,
      externalId: null,
      metadata: {},
    };
  }

  async authenticateCashierSession(
    request: Request,
    response: Response,
  ): Promise<SessionResult> {
    const cashierId = request.cookies?.[CASHIER_SESSION_COOKIE_NAME];

    if (!cashierId) {
      return {
        authenticated: false,
        reason: "no_cashier_session_cookie",
      };
    }

    try {
      const raw = await getRedisClient().get(
        `${CASHIER_SESSION_REDIS_PREFIX}${cashierId}`,
      );

      if (!raw) {
        return {
          authenticated: false,
          reason: "cashier_session_not_found",
        };
      }

      const payload = JSON.parse(raw) as CashierSessionPayload;

      const membership = await this.prisma.userTenant.findUnique({
        select: { status: true },
        where: {
          userId_tenantId: {
            tenantId: payload.tenantId,
            userId: payload.userId,
          },
        },
      });

      if (!membership || membership.status !== "ACTIVE") {
        await getRedisClient().del(
          `${CASHIER_SESSION_REDIS_PREFIX}${cashierId}`,
        );
        return {
          authenticated: false,
          reason: "cashier_session_revoked",
        };
      }

      const user = await this.prisma.user.findUnique({
        select: { id: true, email: true, name: true },
        where: { id: payload.userId },
      });

      if (!user) {
        return { authenticated: false, reason: "cashier_not_found" };
      }

      return {
        accessToken: "",
        authenticated: true,
        organizationId: payload.tenantId,
        role: "CASHIER",
        sessionId: cashierId,
        user: this.makeFakeWorkOSUser(user),
        userId: user.id,
      };
    } catch (error) {
      this.logger.error(`Cashier session lookup failed: ${error}`);
      return { authenticated: false, reason: "cashier_session_error" };
    }
  }

  /**
   * Validates a PIN for a given cashier user id and creates a persistent session.
   *
   * Called by the public /auth/pin endpoint.
   */
  async loginWithPin(
    userId: string,
    pin: string,
    request: Request,
    response: Response,
  ): Promise<SessionResult> {
    const user = await this.prisma.user.findUnique({
      select: { id: true, email: true, name: true, pinHash: true, tenantId: true },
      where: { id: userId },
    });

    if (!user?.pinHash) {
      return { authenticated: false, reason: "cashier_login_invalid" };
    }

    const pinValid = await bcrypt.compare(pin, user.pinHash);
    if (!pinValid) {
      return { authenticated: false, reason: "cashier_login_invalid" };
    }

    // Verify the membership is ACTIVE
    const membership = await this.prisma.userTenant.findUnique({
      select: { status: true },
      where: {
        userId_tenantId: {
          tenantId: user.tenantId,
          userId: user.id,
        },
      },
    });

    if (!membership || membership.status !== "ACTIVE") {
      return { authenticated: false, reason: "cashier_login_disabled" };
    }

    const sessionId = randomUUID();

    const payload: CashierSessionPayload = {
      tenantId: user.tenantId,
      userId: user.id,
    };

    try {
      await getRedisClient().set(
        `${CASHIER_SESSION_REDIS_PREFIX}${sessionId}`,
        JSON.stringify(payload),
      );
    } catch (error) {
      this.logger.error(`Failed to persist cashier session in Redis: ${error}`);
      return { authenticated: false, reason: "cashier_session_persist_failed" };
    }

    response.cookie(
      CASHIER_SESSION_COOKIE_NAME,
      sessionId,
      CASHIER_SESSION_COOKIE_OPTIONS,
    );

    this.logger.log(`Cashier session created: user=${user.id}`);

    return {
      accessToken: "",
      authenticated: true,
      organizationId: user.tenantId,
      role: "CASHIER",
      sessionId,
      user: this.makeFakeWorkOSUser(user),
      userId: user.id,
    };
  }

  /**
   * Deletes all cashier sessions for the given user id.
   */
  async revokeCashierSession(userId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const keys = await redis.keys(
        `${CASHIER_SESSION_REDIS_PREFIX}*`,
      );

      const pipeline = redis.multi();
      for (const key of keys) {
        const raw = await redis.get(key);
        if (raw) {
          try {
            const payload = JSON.parse(raw) as CashierSessionPayload;
            if (payload.userId === userId) {
              pipeline.del(key);
            }
          } catch {
            // skip malformed entries
          }
        }
      }
      await pipeline.exec();
    } catch (error) {
      this.logger.error(`Failed to revoke cashier sessions for user ${userId}: ${error}`);
    }
  }
}
