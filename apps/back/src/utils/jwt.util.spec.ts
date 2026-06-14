import { describe, expect, it, jest } from "@jest/globals";
import { jwtVerify } from "jose";

import { WORKOS_ISSUER, verifyWorkosToken } from "./jwt.util";

jest.mock("jose");

describe("verifyWorkosToken", () => {
  it("returns the decoded payload for a valid token", async () => {
    const mockJwks = jest.fn() as unknown as Parameters<
      typeof verifyWorkosToken
    >[1];
    const mockPayload = {
      exp: Math.floor(Date.now() / 1000) + 300,
      iat: Math.floor(Date.now() / 1000),
      iss: WORKOS_ISSUER,
      sid: "session_01HXYZ",
      sub: "user_01HXYZ",
    };

    jest.mocked(jwtVerify).mockResolvedValueOnce({
      payload: mockPayload,
      protectedHeader: { alg: "RS256" },
    } as never);

    const result = await verifyWorkosToken("valid.jwt.token", mockJwks);

    expect(result).toStrictEqual(mockPayload);
  });

  it("calls jwtVerify with RS256 algorithm enforced", async () => {
    const mockJwks = jest.fn() as unknown as Parameters<
      typeof verifyWorkosToken
    >[1];

    jest.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { exp: 9999, iat: 0, iss: WORKOS_ISSUER, sid: "s", sub: "u" },
      protectedHeader: { alg: "RS256" },
    } as never);

    await verifyWorkosToken("any.jwt.token", mockJwks);

    expect(jest.mocked(jwtVerify)).toHaveBeenCalledWith(
      "any.jwt.token",
      mockJwks,
      expect.objectContaining({ algorithms: ["RS256"] })
    );
  });

  it("calls jwtVerify with WorkOS issuer enforced", async () => {
    const mockJwks = jest.fn() as unknown as Parameters<
      typeof verifyWorkosToken
    >[1];

    jest.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { exp: 9999, iat: 0, iss: WORKOS_ISSUER, sid: "s", sub: "u" },
      protectedHeader: { alg: "RS256" },
    } as never);

    await verifyWorkosToken("any.jwt.token", mockJwks);

    expect(jest.mocked(jwtVerify)).toHaveBeenCalledWith(
      "any.jwt.token",
      mockJwks,
      expect.objectContaining({ issuer: WORKOS_ISSUER })
    );
  });

  it("throws when the token is malformed", async () => {
    const mockJwks = jest.fn() as unknown as Parameters<
      typeof verifyWorkosToken
    >[1];

    jest
      .mocked(jwtVerify)
      .mockRejectedValueOnce(
        Object.assign(new Error("JWTInvalid"), { code: "ERR_JWS_INVALID" })
      );

    await expect(
      verifyWorkosToken("not.a.real.token", mockJwks)
    ).rejects.toThrow("JWTInvalid");
  });

  it("throws when the token has expired", async () => {
    const mockJwks = jest.fn() as unknown as Parameters<
      typeof verifyWorkosToken
    >[1];

    jest
      .mocked(jwtVerify)
      .mockRejectedValueOnce(
        Object.assign(new Error("JWTExpired"), { code: "ERR_JWT_EXPIRED" })
      );

    await expect(
      verifyWorkosToken("expired.jwt.token", mockJwks)
    ).rejects.toThrow("JWTExpired");
  });

  it("throws when the issuer does not match", async () => {
    const mockJwks = jest.fn() as unknown as Parameters<
      typeof verifyWorkosToken
    >[1];

    jest.mocked(jwtVerify).mockRejectedValueOnce(
      Object.assign(new Error("JWTClaimValidationFailed"), {
        claim: "iss",
        code: "ERR_JWT_CLAIM_VALIDATION_FAILED",
      })
    );

    await expect(
      verifyWorkosToken("wrong.issuer.token", mockJwks)
    ).rejects.toThrow("JWTClaimValidationFailed");
  });
});
