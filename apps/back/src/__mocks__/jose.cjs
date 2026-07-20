"use strict";
// Minimal stub for jose — avoids ESM-transpile issues when running tests.
// Real jose is used in production.
/* eslint-disable max-classes-per-file */
module.exports = {
  CompactEncrypt: class {
    setProtectedHeader() {
      return this;
    }
    encrypt() {
      return "mock.encrypted";
    }
  },
  SignJWT: class {
    setProtectedHeader() {
      return this;
    }
    setIssuedAt() {
      return this;
    }
    setExpirationTime() {
      return this;
    }
    sign() {
      return "mock.token";
    }
  },
  compactDecrypt: () => ({ plaintext: new TextEncoder().encode("{}") }),
  createLocalJWKSet: () => () => ({}),
  decodeJwt: () => ({
    exp: Math.floor(Date.now() / 1000) + 3600,
    sid: "mock-session",
  }),
  jwtVerify: () => ({ payload: {}, protectedHeader: {} }),
};
