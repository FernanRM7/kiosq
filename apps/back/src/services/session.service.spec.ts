import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Logger } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { SESSION_COOKIE_NAME } from "../constants/cookie.constants";
import { PrismaService } from "../lib/prisma.service";
import { AuthService } from "./auth.service";
import { SessionRegistryService } from "./session-registry.service";
import { SessionService } from "./session.service";

// ─── Mock factories ───────────────────────────────────────────────────────────

function makeAuthenticatedResult(
  overrides: {
    userId?: string;
    orgId?: string;
    role?: string;
    sessionId?: string;
    accessToken?: string;
  } = {}
) {
  return {
    authenticated: true as const,
    accessToken: overrides.accessToken ?? "access.jwt.token",
    organizationId: overrides.orgId ?? "org_01",
    role: overrides.role ?? "admin",
    sessionId: overrides.sessionId ?? "session_01",
    user: {
      createdAt: "2024-01-01T00:00:00.000Z",
      email: "user@example.com",
      emailVerified: true,
      externalId: null,
      firstName: "Test",
      id: overrides.userId ?? "user_01",
      lastSignInAt: null,
      lastName: "User",
      locale: null,
      metadata: {},
      name: "Test User",
      object: "user" as const,
      profilePictureUrl: null,
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
  };
}

function makeRefreshedResult(overrides: { sealedSession?: string } = {}) {
  return {
    authenticated: true as const,
    sealedSession: overrides.sealedSession ?? "new-sealed-session",
    session: { accessToken: "refreshed.access.token" },
    organizationId: "org_01",
    role: "admin",
    sessionId: "session_02",
    user: {
      createdAt: "2024-01-01T00:00:00.000Z",
      email: "user@example.com",
      emailVerified: true,
      externalId: null,
      firstName: "Test",
      id: "user_01",
      lastSignInAt: null,
      lastName: "User",
      locale: null,
      metadata: {},
      name: "Test User",
      object: "user" as const,
      profilePictureUrl: null,
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
  };
}

// ─── Test setup ───────────────────────────────────────────────────────────────

describe("SessionService", () => {
  let service: SessionService;

  const mockAuthenticate = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const mockRefresh = jest.fn<(...args: unknown[]) => Promise<unknown>>();

  const mockLoadSealedSession = jest
    .fn<
      (...args: unknown[]) => {
        authenticate: (...args: unknown[]) => Promise<unknown>;
        refresh: (...args: unknown[]) => Promise<unknown>;
      }
    >()
    .mockReturnValue({
      authenticate: mockAuthenticate,
      refresh: mockRefresh,
    });

  const mockAuthService = {
    cookiePassword: "test-password-that-is-32-chars-min",
    workos: {
      userManagement: { loadSealedSession: mockLoadSealedSession },
    },
  } as unknown as AuthService;

  jest.spyOn(Logger.prototype, "debug").mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAuthenticate.mockReset();
    mockRefresh.mockReset();

    mockLoadSealedSession.mockReturnValue({
      authenticate: mockAuthenticate,
      refresh: mockRefresh,
    });

    const mockSessionRegistry = {
      registerSession: jest.fn<(...args: unknown[]) => Promise<void>>(),
      revokeSession: jest.fn<(...args: unknown[]) => Promise<void>>(),
      isSessionActive: jest
        .fn<(...args: unknown[]) => Promise<boolean>>()
        .mockResolvedValue(true),
      touchSession: jest
        .fn<(...args: unknown[]) => Promise<void>>()
        .mockResolvedValue(undefined),
    } as unknown as SessionRegistryService;
    const mockPrisma = {
      user: {
        findUnique: jest
          .fn<(...args: unknown[]) => Promise<null>>()
          .mockResolvedValue(null),
      },
    } as unknown as PrismaService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: AuthService, useValue: mockAuthService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SessionRegistryService, useValue: mockSessionRegistry },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  function makeRequest(cookieValue?: string) {
    return {
      cookies: cookieValue ? { [SESSION_COOKIE_NAME]: cookieValue } : {},
    } as never;
  }

  function makeResponse() {
    return { cookie: jest.fn(), clearCookie: jest.fn() } as never;
  }

  // ── Scenario 1: Valid session ──────────────────────────────────────────────

  describe("authenticateSession — valid session", () => {
    it("returns authenticated result when cookie is valid", async () => {
      mockAuthenticate.mockResolvedValueOnce(makeAuthenticatedResult());

      const result = await service.authenticateSession(
        makeRequest("valid-sealed-session"),
        makeResponse()
      );

      expect(result.authenticated).toBe(true);
      if (result.authenticated) {
        expect(result.userId).toBe("user_01");
        expect(result.organizationId).toBe("org_01");
        expect(result.role).toBe("admin");
        expect(result.accessToken).toBe("access.jwt.token");
      }
    });

    it("passes cookiePassword and sessionData to loadSealedSession", async () => {
      mockAuthenticate.mockResolvedValueOnce(makeAuthenticatedResult());

      await service.authenticateSession(
        makeRequest("my-session"),
        makeResponse()
      );

      expect(mockLoadSealedSession).toHaveBeenCalledWith({
        cookiePassword: mockAuthService.cookiePassword,
        sessionData: "my-session",
      });
    });

    it("rejects before loading WorkOS when the cookie is absent", async () => {
      const result = await service.authenticateSession(
        makeRequest(),
        makeResponse()
      );

      expect(result).toStrictEqual({
        authenticated: false,
        reason: "no_session_cookie_provided",
      });
      expect(mockLoadSealedSession).not.toHaveBeenCalled();
    });
  });

  // ── Scenario 2: Expired JWT → auto-refresh ────────────────────────────────

  describe("authenticateSession — expired JWT triggers auto-refresh", () => {
    it("calls session.refresh() when reason is invalid_jwt", async () => {
      mockAuthenticate.mockResolvedValueOnce({
        authenticated: false,
        reason: "invalid_jwt",
      });
      mockRefresh.mockResolvedValueOnce(makeRefreshedResult());

      await service.authenticateSession(
        makeRequest("expired-session"),
        makeResponse()
      );

      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    it("writes the new sealed session to the response cookie after refresh", async () => {
      const response = makeResponse();

      mockAuthenticate.mockResolvedValueOnce({
        authenticated: false,
        reason: "invalid_jwt",
      });
      mockRefresh.mockResolvedValueOnce(
        makeRefreshedResult({ sealedSession: "fresh-sealed-session" })
      );

      await service.authenticateSession(makeRequest("expired"), response);

      expect(
        (response as unknown as { cookie: jest.Mock }).cookie
      ).toHaveBeenCalledWith(
        SESSION_COOKIE_NAME,
        "fresh-sealed-session",
        expect.objectContaining({ httpOnly: true })
      );
    });

    it("returns authenticated result with refreshed access token", async () => {
      mockAuthenticate.mockResolvedValueOnce({
        authenticated: false,
        reason: "invalid_jwt",
      });
      mockRefresh.mockResolvedValueOnce(makeRefreshedResult());

      const result = await service.authenticateSession(
        makeRequest("expired"),
        makeResponse()
      );

      expect(result.authenticated).toBe(true);
      if (result.authenticated) {
        expect(result.accessToken).toBe("refreshed.access.token");
        expect(result.userId).toBe("user_01");
      }
    });

    it("returns unauthenticated and does NOT write cookie when refresh fails", async () => {
      mockAuthenticate.mockResolvedValueOnce({
        authenticated: false,
        reason: "invalid_jwt",
      });
      mockRefresh.mockResolvedValueOnce({
        authenticated: false,
        reason: "invalid_session",
      });
      const response = makeResponse();

      const result = await service.authenticateSession(
        makeRequest("expired"),
        response
      );

      expect(result.authenticated).toBe(false);
      expect(
        (response as unknown as { cookie: jest.Mock }).cookie
      ).not.toHaveBeenCalled();
    });
  });

  // ── Scenario 3: Non-recoverable failure ───────────────────────────────────

  describe("authenticateSession — non-recoverable failures", () => {
    it("does NOT call refresh for reasons other than invalid_jwt", async () => {
      mockAuthenticate.mockResolvedValueOnce({
        authenticated: false,
        reason: "session_revoked",
      });

      await service.authenticateSession(makeRequest("session"), makeResponse());

      expect(mockRefresh).not.toHaveBeenCalled();
    });

    it("preserves the WorkOS reason string in the unauthenticated result", async () => {
      mockAuthenticate.mockResolvedValueOnce({
        authenticated: false,
        reason: "session_revoked",
      });

      const result = await service.authenticateSession(
        makeRequest("session"),
        makeResponse()
      );

      expect(result.authenticated).toBe(false);
      if (!result.authenticated) {
        expect(result.reason).toBe("session_revoked");
      }
    });
  });

  // ── clearSession ──────────────────────────────────────────────────────────

  describe("clearSession", () => {
    it("calls clearCookie with the session cookie name and path /", () => {
      const response = makeResponse();

      service.clearSession(response);

      expect(
        (response as unknown as { clearCookie: jest.Mock }).clearCookie
      ).toHaveBeenCalledWith(
        SESSION_COOKIE_NAME,
        expect.objectContaining({ path: "/" })
      );
    });
  });
});
