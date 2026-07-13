import { Injectable, Logger } from "@nestjs/common";

import { cid } from "../lib/request-context";
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

  private async withRedis<T>(
    operation: () => Promise<T>,
    context: string,
    fallback?: T
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.logger.error(
        { error, key: context },
        `Redis operation failed: ${context}`
      );
      return fallback as T;
    }
  }

  /**
   * Registers a new session in Redis after a successful login.
   * Stores session metadata and adds the session ID to the user's session set.
   */
  async registerSession(metadata: SessionMetadata): Promise<void> {
    await this.withRedis(async () => {
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
        `${cid()} Session registered: sessionId=${metadata.sessionId} userId=${metadata.userId} ttl=${SESSION_TTL_SECONDS}s prefix=${SESSION_PREFIX}`
      );
    }, `registerSession:${metadata.userId}`);
  }

  /**
   * Retrieves all active sessions for a user.
   */
  getSessionsForUser(userId: string): Promise<SessionMetadata[]> {
    return this.withRedis(
      async () => {
        const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
        const sessionIds = await getRedisClient().sMembers(userSessionsKey);

        if (sessionIds.length === 0) {
          this.logger.debug(`${cid()} Cache miss: no sessions for user ${userId}`);
          return [];
        }

        const sessions = await Promise.all(
          sessionIds.map(async (sessionId) => {
            const sessionKey = `${SESSION_PREFIX}${userId}:${sessionId}`;
            const data = await getRedisClient().hGetAll(sessionKey);

            if (!data || Object.keys(data).length === 0) {
              await getRedisClient().sRem(userSessionsKey, sessionId);
              return null;
            }

            return this.parseSessionMetadata(data);
          })
        );

        const result = sessions.filter((s): s is SessionMetadata => s !== null);
        this.logger.debug(
          `${cid()} Cache hit: ${result.length} sessions for user ${userId}`
        );
        return result;
      },
      `getSessionsForUser:${userId}`,
      []
    );
  }

  /**
   * Removes a specific session from Redis (logout / revoke).
   */
  async removeSession(userId: string, sessionId: string): Promise<void> {
    await this.withRedis(async () => {
      const sessionKey = `${SESSION_PREFIX}${userId}:${sessionId}`;
      const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;

      await Promise.all([
        getRedisClient().del(sessionKey),
        getRedisClient().sRem(userSessionsKey, sessionId),
      ]);

      this.logger.debug(`${cid()} Session removed: sessionId=${sessionId} userId=${userId}`);
    }, `removeSession:${userId}`);
  }

  /**
   * Removes all sessions for a user (e.g. password change, admin action).
   */
  async removeAllSessions(userId: string): Promise<void> {
    await this.withRedis(async () => {
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
        `${cid()} All sessions removed for user ${userId} (${sessionIds.length} sessions)`
      );
    }, `removeAllSessions:${userId}`);
  }

  /**
   * Checks if a specific session is still active (not revoked).
   */
  isSessionActive(userId: string, sessionId: string): Promise<boolean> {
    return this.withRedis(
      async () => {
        const sessionKey = `${SESSION_PREFIX}${userId}:${sessionId}`;
        const active = (await getRedisClient().exists(sessionKey)) === 1;
        this.logger.debug(
          `${cid()} Session ${sessionId} for user ${userId}: ${active ? "active" : "inactive"}`
        );
        return active;
      },
      `isSessionActive:${userId}`,
      true
    );
  }

  /**
   * Updates the lastActiveAt timestamp for a session (heartbeat)
   * and extends the Redis key TTL to prevent silent expiration.
   */
  async touchSession(userId: string, sessionId: string): Promise<void> {
    await this.withRedis(async () => {
      const sessionKey = `${SESSION_PREFIX}${userId}:${sessionId}`;
      const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
      await Promise.all([
        getRedisClient().hSet(
          sessionKey,
          "lastActiveAt",
          new Date().toISOString()
        ),
        getRedisClient().expire(sessionKey, SESSION_TTL_SECONDS),
        getRedisClient().expire(userSessionsKey, SESSION_TTL_SECONDS),
      ]);
    }, `touchSession:${userId}`);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /**
   * Safely maps a Redis hGetAll result (Record<string, string>) to a typed
   * SessionMetadata object. Acts as a data integrity barrier: if any field is
   * missing or the hash is partially corrupt, it defaults to an empty string
   * rather than surfacing a runtime type mismatch.
   *
   * This prevents the unsafe `as unknown as SessionMetadata` cast and ensures
   * that adding typed fields (e.g. booleans, numbers) to SessionMetadata in the
   * future will produce a compile-time error that forces explicit conversion.
   */
  private parseSessionMetadata(data: Record<string, string>): SessionMetadata {
    return {
      createdAt: data["createdAt"] ?? "",
      deviceInfo: data["deviceInfo"] ?? "",
      ipAddress: data["ipAddress"] ?? "",
      lastActiveAt: data["lastActiveAt"] ?? "",
      sessionId: data["sessionId"] ?? "",
      userEmail: data["userEmail"] ?? "",
      userId: data["userId"] ?? "",
      userName: data["userName"] ?? "",
    };
  }

  private getSessionIdsForUser(userId: string): Promise<string[]> {
    const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
    return getRedisClient().sMembers(userSessionsKey);
  }
}
