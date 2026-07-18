"use strict";
// Minimal stub for jose — avoids ESM-transpile issues when running tests.
// Real jose is used in production.
module.exports = {
  decodeJwt: () => ({
    exp: Math.floor(Date.now() / 1000) + 3600,
    sid: "mock-session",
  }),
  createLocalJWKSet: () => () => ({}),
  jwtVerify: () => ({ payload: {}, protectedHeader: {} }),
  SignJWT: class {
    setProtectedHeader() { return this; }
    setIssuedAt() { return this; }
    setExpirationTime() { return this; }
    sign() { return "mock.token"; }
  },
  compactDecrypt: () => ({ plaintext: new TextEncoder().encode("{}") }),
  CompactEncrypt: class {
    setProtectedHeader() { return this; }
    encrypt() { return "mock.encrypted"; }
  },
};
