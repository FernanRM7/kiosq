import { createHash } from "node:crypto";

import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";

import { getRedisClient } from "../lib/redis.lib";

const IDENTITY_ATTEMPT_LIMIT = 5;
const IP_ATTEMPT_LIMIT = 30;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_ATTEMPT_PREFIX = "cashier_login_attempt:";

const CONSUME_ATTEMPT_SCRIPT = `
local identityAttempts = tonumber(redis.call("GET", KEYS[1]) or "0")
local ipAttempts = tonumber(redis.call("GET", KEYS[2]) or "0")

if identityAttempts >= tonumber(ARGV[2]) or ipAttempts >= tonumber(ARGV[3]) then
  return { 0, identityAttempts, ipAttempts }
end

identityAttempts = redis.call("INCR", KEYS[1])
if identityAttempts == 1 or redis.call("TTL", KEYS[1]) < 0 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end

ipAttempts = redis.call("INCR", KEYS[2])
if ipAttempts == 1 or redis.call("TTL", KEYS[2]) < 0 then
  redis.call("EXPIRE", KEYS[2], ARGV[1])
end

return { 1, identityAttempts, ipAttempts }
`;

const REGISTER_SUCCESS_SCRIPT = `
redis.call("DEL", KEYS[1])

local ipAttempts = tonumber(redis.call("GET", KEYS[2]) or "0")
if ipAttempts <= 1 then
  redis.call("DEL", KEYS[2])
else
  redis.call("DECR", KEYS[2])
end

return 1
`;

const RELEASE_ATTEMPT_SCRIPT = `
for index = 1, #KEYS do
  local attempts = tonumber(redis.call("GET", KEYS[index]) or "0")
  if attempts <= 1 then
    redis.call("DEL", KEYS[index])
  else
    redis.call("DECR", KEYS[index])
  end
end

return 1
`;

export interface LoginAttemptContext {
  cashierCode: string;
  clientAddress: string;
  tenantSlug: string;
}

@Injectable()
export class CashierLoginRateLimitService {
  private readonly logger = new Logger(CashierLoginRateLimitService.name);

  async consumeAttempt(context: LoginAttemptContext): Promise<void> {
    const { identityKey, ipKey } = this.resolveKeys(context);

    try {
      const result = await getRedisClient().eval(CONSUME_ATTEMPT_SCRIPT, {
        arguments: [
          String(LOGIN_WINDOW_SECONDS),
          String(IDENTITY_ATTEMPT_LIMIT),
          String(IP_ATTEMPT_LIMIT),
        ],
        keys: [identityKey, ipKey],
      });

      if (!Array.isArray(result) || result.length < 3) {
        throw new Error("Redis returned an invalid rate limit result");
      }

      const [allowed, identityAttempts, ipAttempts] = result.map(Number);

      if (
        !Number.isFinite(allowed) ||
        !Number.isFinite(identityAttempts) ||
        !Number.isFinite(ipAttempts)
      ) {
        throw new TypeError("Redis returned invalid rate limit counters");
      }

      if (allowed !== 1) {
        throw new HttpException(
          "Demasiados intentos. Espera unos minutos antes de volver a intentar",
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
    } catch (error) {
      if (
        error instanceof HttpException &&
        error.getStatus() === HttpStatus.TOO_MANY_REQUESTS
      ) {
        throw error;
      }

      this.logger.error(
        { error },
        "Cashier login rate limit could not be consumed"
      );
      throw new ServiceUnavailableException(
        "El acceso de cajeros no está disponible temporalmente"
      );
    }
  }

  async registerSuccess(context: LoginAttemptContext): Promise<void> {
    const { identityKey, ipKey } = this.resolveKeys(context);

    try {
      await getRedisClient().eval(REGISTER_SUCCESS_SCRIPT, {
        keys: [identityKey, ipKey],
      });
    } catch (error) {
      this.logger.error(
        { error },
        "Cashier login rate limit could not register a successful attempt"
      );
      throw new ServiceUnavailableException(
        "El acceso de cajeros no está disponible temporalmente"
      );
    }
  }

  async releaseAttempt(context: LoginAttemptContext): Promise<void> {
    const { identityKey, ipKey } = this.resolveKeys(context);

    try {
      await getRedisClient().eval(RELEASE_ATTEMPT_SCRIPT, {
        keys: [identityKey, ipKey],
      });
    } catch (error) {
      this.logger.warn(
        { error },
        "Cashier login rate limit reservation could not be released"
      );
    }
  }

  private resolveKeys(context: LoginAttemptContext): {
    identityKey: string;
    ipKey: string;
  } {
    const normalizedIdentity = [
      context.tenantSlug.trim().toLowerCase(),
      context.cashierCode.trim().toUpperCase(),
    ].join("\0");
    const normalizedIp = context.clientAddress.trim() || "unknown";

    return {
      identityKey: `${LOGIN_ATTEMPT_PREFIX}identity:${this.digest(normalizedIdentity)}`,
      ipKey: `${LOGIN_ATTEMPT_PREFIX}ip:${this.digest(normalizedIp)}`,
    };
  }

  private digest(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }
}
