import { pbkdf2Sync, randomBytes } from "node:crypto";

import { describe, expect, it } from "@jest/globals";
import * as bcrypt from "bcrypt";

import { hashCashierPin, verifyCashierPin } from "./cashier-pin";

describe("cashier PIN credentials", () => {
  it("creates a bcrypt hash with the current work factor", async () => {
    const hash = await hashCashierPin("123456");

    expect(hash.startsWith("$2")).toBe(true);
    expect(bcrypt.getRounds(hash)).toBe(12);
    await expect(bcrypt.compare("123456", hash)).resolves.toBe(true);
  });

  it("accepts a current bcrypt PIN without requesting a rehash", async () => {
    const hash = await hashCashierPin("123456");

    await expect(verifyCashierPin("123456", hash)).resolves.toStrictEqual({
      needsRehash: false,
      valid: true,
    });
  });

  it("rejects an incorrect bcrypt PIN", async () => {
    const hash = await hashCashierPin("123456");

    await expect(verifyCashierPin("654321", hash)).resolves.toStrictEqual({
      needsRehash: false,
      valid: false,
    });
  });

  it("accepts a legacy PBKDF2 PIN and requests a rehash", async () => {
    const salt = randomBytes(16).toString("hex");
    const legacyHash = pbkdf2Sync(
      "123456",
      salt,
      100_000,
      64,
      "sha256"
    ).toString("hex");

    await expect(
      verifyCashierPin("123456", `pbkdf2$100000$${salt}$${legacyHash}`)
    ).resolves.toStrictEqual({
      needsRehash: true,
      valid: true,
    });
  });

  it("rejects malformed and unsafe legacy hashes", async () => {
    await expect(
      verifyCashierPin("123456", "pbkdf2$999999999$salt$abcd")
    ).resolves.toStrictEqual({
      needsRehash: false,
      valid: false,
    });
  });
});
