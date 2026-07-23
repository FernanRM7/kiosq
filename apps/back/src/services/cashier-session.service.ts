import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";
import type { Request, Response } from "express";

import {
  CASHIER_SESSION_COOKIE_NAME,
  CASHIER_SESSION_COOKIE_OPTIONS,
  CASHIER_SESSION_TTL_SECONDS,
} from "../constants/cookie.constants";
import { PrismaService } from "../lib/prisma.service";
import { getRedisClient } from "../lib/redis.lib";
import type { SessionResult } from "../types/session.type";

const CASHIER_SESSION_REDIS_PREFIX = "cashier_session:";
const CASHIER_USER_SESSIONS_REDIS_PREFIX = "cashier_user_sessions:";
const OPAQUE_SESSION_ID_PATTERN = /^[\w-]{43}$/u;
const SESSION_CLOCK_SKEW_MS = 60_000;

const CREATE_SESSION_SCRIPT = `
redis.call("SET", KEYS[1], ARGV[1], "EX", ARGV[3])
redis.call("SADD", KEYS[2], ARGV[2])
redis.call("EXPIRE", KEYS[2], ARGV[3])
return 1
`;

const DELETE_SESSION_SCRIPT = `
redis.call("DEL", KEYS[1])
redis.call("SREM", KEYS[2], ARGV[1])
return 1
`;

const REVOKE_USER_SESSIONS_SCRIPT = `
local sessionIds = redis.call("SMEMBERS", KEYS[1])
for _, sessionId in ipairs(sessionIds) do
  redis.call("DEL", ARGV[1] .. sessionId)
end
redis.call("DEL", KEYS[1])
return #sessionIds
`;

interface CashierSessionPayload {
  credentialFingerprint: string;
  createdAt: string;
  tenantId: string;
  userId: string;
}

interface CreateCashierSessionInput {
  pinHash: string;
  tenantId: string;
  userId: string;
}

interface CashierMembershipSnapshot {
  role: string;
  status: string;
  tenant: { status: string };
  user: {
    email: string | null;
    id: string;
    isActive: boolean;
    name: string;
    pinHash: string | null;
    role: string;
    tenantId: string;
  };
}

@Injectable()
export class CashierSessionService {
  private readonly logger = new Logger(CashierSessionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async authenticateCashierSession(
    request: Request,
    response: Response
  ): Promise<SessionResult> {
    const sessionId = request.cookies?.[CASHIER_SESSION_COOKIE_NAME] as
      | string
      | undefined;

    if (!sessionId) {
      return { authenticated: false, reason: "no_cashier_session_cookie" };
    }

    if (!OPAQUE_SESSION_ID_PATTERN.test(sessionId)) {
      this.clearSessionCookie(response);
      return { authenticated: false, reason: "cashier_session_invalid" };
    }

    try {
      const redis = getRedisClient();
      const raw = await redis.get(this.sessionKey(sessionId));

      if (!raw) {
        this.clearSessionCookie(response);
        return { authenticated: false, reason: "cashier_session_not_found" };
      }

      const payload = this.parsePayload(raw);

      if (!payload) {
        await redis.del(this.sessionKey(sessionId));
        this.clearSessionCookie(response);
        return { authenticated: false, reason: "cashier_session_invalid" };
      }

      if (this.isSessionExpired(payload.createdAt)) {
        this.clearSessionCookie(response);
        await this.deleteSession(sessionId, payload.userId);
        return { authenticated: false, reason: "cashier_session_expired" };
      }

      const membership = await this.prisma.userTenant.findUnique({
        select: {
          role: true,
          status: true,
          tenant: { select: { status: true } },
          user: {
            select: {
              email: true,
              id: true,
              isActive: true,
              name: true,
              pinHash: true,
              role: true,
              tenantId: true,
            },
          },
        },
        where: {
          userId_tenantId: {
            tenantId: payload.tenantId,
            userId: payload.userId,
          },
        },
      });

      if (!this.isPrincipalActive(membership, payload)) {
        await this.deleteSession(sessionId, payload.userId);
        this.clearSessionCookie(response);
        return { authenticated: false, reason: "cashier_session_revoked" };
      }

      const { user } = membership;

      return {
        accessToken: "",
        authType: "cashier",
        authenticated: true,
        dbUserId: user.id,
        organizationId: undefined,
        role: membership.role,
        sessionId,
        tenantId: payload.tenantId,
        user: {
          email: user.email,
          emailVerified: false,
          firstName: null,
          id: user.id,
          lastName: null,
          name: user.name,
        },
        userId: user.id,
      };
    } catch (error) {
      this.logger.error({ error }, "Cashier session validation failed closed");
      return { authenticated: false, reason: "cashier_session_unavailable" };
    }
  }

  clearSessionCookie(response: Response): void {
    response.clearCookie(CASHIER_SESSION_COOKIE_NAME, {
      httpOnly: CASHIER_SESSION_COOKIE_OPTIONS.httpOnly,
      path: CASHIER_SESSION_COOKIE_OPTIONS.path,
      sameSite: CASHIER_SESSION_COOKIE_OPTIONS.sameSite,
      secure: CASHIER_SESSION_COOKIE_OPTIONS.secure,
    });
  }

  async createSession(input: CreateCashierSessionInput): Promise<string> {
    const sessionId = randomBytes(32).toString("base64url");
    const payload: CashierSessionPayload = {
      createdAt: new Date().toISOString(),
      credentialFingerprint: this.fingerprint(input.pinHash),
      tenantId: input.tenantId,
      userId: input.userId,
    };
    const redis = getRedisClient();

    await redis.eval(CREATE_SESSION_SCRIPT, {
      arguments: [
        JSON.stringify(payload),
        sessionId,
        String(CASHIER_SESSION_TTL_SECONDS),
      ],
      keys: [this.sessionKey(sessionId), this.userSessionsKey(input.userId)],
    });

    return sessionId;
  }

  async revokeCashierSession(userId: string): Promise<void> {
    await getRedisClient().eval(REVOKE_USER_SESSIONS_SCRIPT, {
      arguments: [CASHIER_SESSION_REDIS_PREFIX],
      keys: [this.userSessionsKey(userId)],
    });
  }

  async revokeSession(sessionId: string): Promise<void> {
    if (!OPAQUE_SESSION_ID_PATTERN.test(sessionId)) {
      return;
    }

    const redis = getRedisClient();
    const raw = await redis.get(this.sessionKey(sessionId));
    const payload = raw ? this.parsePayload(raw) : null;

    if (!payload) {
      await redis.del(this.sessionKey(sessionId));
      return;
    }

    await this.deleteSession(sessionId, payload.userId);
  }

  writeSessionCookie(response: Response, sessionId: string): void {
    response.cookie(
      CASHIER_SESSION_COOKIE_NAME,
      sessionId,
      CASHIER_SESSION_COOKIE_OPTIONS
    );
  }

  private async deleteSession(
    sessionId: string,
    userId: string
  ): Promise<void> {
    await getRedisClient().eval(DELETE_SESSION_SCRIPT, {
      arguments: [sessionId],
      keys: [this.sessionKey(sessionId), this.userSessionsKey(userId)],
    });
  }

  private fingerprint(pinHash: string): string {
    return createHash("sha256").update(pinHash).digest("base64url");
  }

  private fingerprintsMatch(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private isPrincipalActive(
    membership: CashierMembershipSnapshot | null,
    payload: CashierSessionPayload
  ): membership is CashierMembershipSnapshot {
    if (!membership?.user.pinHash) {
      return false;
    }

    const allowedTenantStatuses = new Set(["ACTIVE", "TRIAL"]);
    const expectedFingerprint = this.fingerprint(membership.user.pinHash);

    return [
      membership.status === "ACTIVE",
      membership.role === "CASHIER",
      allowedTenantStatuses.has(membership.tenant.status),
      membership.user.isActive,
      membership.user.role === "CASHIER",
      membership.user.tenantId === payload.tenantId,
      this.fingerprintsMatch(
        payload.credentialFingerprint,
        expectedFingerprint
      ),
    ].every(Boolean);
  }

  private parsePayload(raw: string): CashierSessionPayload | null {
    try {
      const payload = JSON.parse(raw) as Partial<CashierSessionPayload>;

      if (
        typeof payload.credentialFingerprint !== "string" ||
        typeof payload.createdAt !== "string" ||
        typeof payload.tenantId !== "string" ||
        typeof payload.userId !== "string" ||
        payload.credentialFingerprint.length === 0 ||
        !Number.isFinite(Date.parse(payload.createdAt)) ||
        payload.tenantId.length === 0 ||
        payload.userId.length === 0
      ) {
        return null;
      }

      return payload as CashierSessionPayload;
    } catch {
      return null;
    }
  }

  private sessionKey(sessionId: string): string {
    return `${CASHIER_SESSION_REDIS_PREFIX}${sessionId}`;
  }

  private isSessionExpired(createdAt: string): boolean {
    const createdAtMs = Date.parse(createdAt);
    const now = Date.now();

    return (
      createdAtMs > now + SESSION_CLOCK_SKEW_MS ||
      now - createdAtMs >= CASHIER_SESSION_TTL_SECONDS * 1000
    );
  }

  private userSessionsKey(userId: string): string {
    return `${CASHIER_USER_SESSIONS_REDIS_PREFIX}${userId}`;
  }
}
