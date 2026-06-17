import { Injectable, Logger } from "@nestjs/common";

import { getRedisClient } from "../lib/redis.lib";

/** Metadata stored in Redis for each active session */
export interface SessionMetadata {
  sessionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  deviceInfo: string;
  ipAddress: string;
  createdAt: string;
  lastActiveAt: string;
}

// 7 days — matches cookie maxAge
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const SESSION_PREFIX = "session:";
const USER_SESSIONS_PREFIX = "user_sessions:";

@Injectable()
export class SessionRegistryService {
  private readonly logger = new Logger(SessionRegistryService.name);

  /**
   * Registers a new session in Redis after a successful login.
   * Stores session metadata and adds the session ID to the user's session set.
   */
  async registerSession(metadata: SessionMetadata): Promise<void> {
    const sessionKey = `${SESSION_PREFIX}${metadata.userId}:${metadata.sessionId}`;
    const userSessionsKey = `${USER_SESSIONS_PREFIX}${metadata.userId}`;

    const redis = getRedisClient();
    await Promise.all([
      redis.hSet(sessionKey, {
        createdAt: metadata.createdAt,
        deviceInfo: metadata.deviceInfo,
        ipAddress: metadata.ipAddress,
        lastActiveAt: metadata.lastActiveAt,
        sessionId: metadata.sessionId,
        userEmail: metadata.userEmail,
        userId: metadata.userId,
        userName: metadata.userName,
      }),
      redis.expire(sessionKey, SESSION_TTL_SECONDS),
      redis.sAdd(userSessionsKey, metadata.sessionId),
      redis.expire(userSessionsKey, SESSION_TTL_SECONDS),
    ]);

    this.logger.debug(
      `Session registered: ${metadata.sessionId} for user ${metadata.userId}`
    );
  }

  /**
   * Retrieves all active sessions for a user.
   */
  async getSessionsForUser(userId: string): Promise<SessionMetadata[]> {
    const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
    const sessionIds = await getRedisClient().sMembers(userSessionsKey);

    if (sessionIds.length === 0) {
      return [];
    }

    const sessions = await Promise.all(
      sessionIds.map(async (sessionId) => {
        const sessionKey = `${SESSION_PREFIX}${userId}:${sessionId}`;
        const data = await getRedisClient().hGetAll(sessionKey);

        if (!data || Object.keys(data).length === 0) {
          // Stale reference — clean up
          await getRedisClient().sRem(userSessionsKey, sessionId);
          return null;
        }

        return data as unknown as SessionMetadata;
      })
    );

    return sessions.filter((s): s is SessionMetadata => s !== null);
  }

  /**
   * Removes a specific session from Redis (logout / revoke).
   */
  async removeSession(userId: string, sessionId: string): Promise<void> {
    const sessionKey = `${SESSION_PREFIX}${userId}:${sessionId}`;
    const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;

    await Promise.all([
      getRedisClient().del(sessionKey),
      getRedisClient().sRem(userSessionsKey, sessionId),
    ]);

    this.logger.debug(`Session removed: ${sessionId} for user ${userId}`);
  }

  /**
   * Removes all sessions for a user (e.g. password change, admin action).
   */
  async removeAllSessions(userId: string): Promise<void> {
    const sessionIds = await this.getSessionIdsForUser(userId);

    if (sessionIds.length === 0) {
      return;
    }

    const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;

    await Promise.all([
      ...sessionIds.map((sid) =>
        getRedisClient().del(`${SESSION_PREFIX}${userId}:${sid}`)
      ),
      getRedisClient().del(userSessionsKey),
    ]);

    this.logger.debug(
      `All sessions removed for user ${userId} (${sessionIds.length} sessions)`
    );
  }

  /**
   * Checks if a specific session is still active (not revoked).
   */
  async isSessionActive(userId: string, sessionId: string): Promise<boolean> {
    const sessionKey = `${SESSION_PREFIX}${userId}:${sessionId}`;
    return (await getRedisClient().exists(sessionKey)) === 1;
  }

  /**
   * Updates the lastActiveAt timestamp for a session (heartbeat).
   */
  async touchSession(userId: string, sessionId: string): Promise<void> {
    const sessionKey = `${SESSION_PREFIX}${userId}:${sessionId}`;
    await getRedisClient().hSet(
      sessionKey,
      "lastActiveAt",
      new Date().toISOString()
    );
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /**
   * Registers a minimal session entry so isSessionActive returns true.
   * Used when the post-login registration failed (Redis unavailable, etc.)
   * and the first authenticated request needs to create the record.
   */
  async registerDummySession(userId: string, sessionId: string): Promise<void> {
    const sessionKey = `${SESSION_PREFIX}${userId}:${sessionId}`;
    const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;

    const redis = getRedisClient();
    await Promise.all([
      redis.hSet(sessionKey, {
        createdAt: new Date().toISOString(),
        deviceInfo: "auto-registered",
        ipAddress: "unknown",
        lastActiveAt: new Date().toISOString(),
        sessionId,
        userEmail: "",
        userId,
        userName: "User",
      }),
      redis.expire(sessionKey, SESSION_TTL_SECONDS),
      redis.sAdd(userSessionsKey, sessionId),
      redis.expire(userSessionsKey, SESSION_TTL_SECONDS),
    ]);

    this.logger.debug(
      `Dummy session registered: ${sessionId} for user ${userId}`
    );
  }

  private getSessionIdsForUser(userId: string): Promise<string[]> {
    const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
    return getRedisClient().sMembers(userSessionsKey);
  }
}
