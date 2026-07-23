import { pbkdf2, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import * as bcrypt from "bcrypt";

const BCRYPT_ROUNDS = 12;
const LEGACY_ALGORITHM = "pbkdf2";
const MAX_LEGACY_ITERATIONS = 1_000_000;
const MIN_LEGACY_ITERATIONS = 10_000;
const PBKDF2_KEY_LENGTH = 64;
const pbkdf2Async = promisify(pbkdf2);

export interface CashierPinVerification {
  needsRehash: boolean;
  valid: boolean;
}

export function hashCashierPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_ROUNDS);
}

export async function verifyCashierPin(
  pin: string,
  storedHash: string
): Promise<CashierPinVerification> {
  if (storedHash.startsWith("$2")) {
    try {
      const valid = await bcrypt.compare(pin, storedHash);
      const rounds = bcrypt.getRounds(storedHash);

      return {
        needsRehash: valid && rounds < BCRYPT_ROUNDS,
        valid,
      };
    } catch {
      return { needsRehash: false, valid: false };
    }
  }

  const [algorithm, rawIterations, salt, expectedHex] = storedHash.split("$");
  const iterations = Number(rawIterations);

  if (
    algorithm !== LEGACY_ALGORITHM ||
    !Number.isInteger(iterations) ||
    iterations < MIN_LEGACY_ITERATIONS ||
    iterations > MAX_LEGACY_ITERATIONS ||
    !salt ||
    !/^[\da-f]+$/iu.test(salt) ||
    !expectedHex ||
    !/^[\da-f]+$/iu.test(expectedHex)
  ) {
    return { needsRehash: false, valid: false };
  }

  const expected = Buffer.from(expectedHex, "hex");

  if (expected.length !== PBKDF2_KEY_LENGTH) {
    return { needsRehash: false, valid: false };
  }

  try {
    const computed = await pbkdf2Async(
      pin,
      salt,
      iterations,
      PBKDF2_KEY_LENGTH,
      "sha256"
    );
    const valid = timingSafeEqual(computed, expected);

    return { needsRehash: valid, valid };
  } catch {
    return { needsRehash: false, valid: false };
  }
}
