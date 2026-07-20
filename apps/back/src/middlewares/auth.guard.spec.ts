jest.mock("../services/session.service");
jest.mock("../services/cashier-session.service");

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import {
  CASHIER_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "../constants/cookie.constants";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { CashierSessionService } from "../services/cashier-session.service";
import { SessionService } from "../services/session.service";
import type { SessionResult } from "../types/session.type";
import { AuthGuard } from "./auth.guard";

// ─── Mock factories ───────────────────────────────────────────────────────────

interface MockRequest {
  cookies: Record<string, string>;
  user?: unknown;
}

interface MockResponse {
  cookie: jest.Mock;
}

function makeHttpContext(request: MockRequest, response: MockResponse) {
  const handler = {};
  const cls = {};

  const context = {
    getClass: () => cls,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: <T>() => request as unknown as T,
      getResponse: <T>() => response as unknown as T,
    }),
  } as unknown as ExecutionContext;

  return { context };
}

// ─── Test setup ───────────────────────────────────────────────────────────────

describe("AuthGuard", () => {
  let guard: AuthGuard;

  const mockAuthenticateSession =
    jest.fn<(...args: unknown[]) => Promise<SessionResult>>();
  const mockAuthenticateCashierSession =
    jest.fn<(...args: unknown[]) => Promise<SessionResult>>();
  const mockGetAllAndOverride = jest.fn<(...args: unknown[]) => boolean>();

  const mockSessionService = {
    authenticateSession: mockAuthenticateSession,
  } as unknown as SessionService;

  const mockCashierSessionService = {
    authenticateCashierSession: mockAuthenticateCashierSession,
  } as unknown as CashierSessionService;

  const mockReflector = {
    getAllAndOverride: mockGetAllAndOverride,
  } as unknown as Reflector;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: SessionService, useValue: mockSessionService },
        { provide: CashierSessionService, useValue: mockCashierSessionService },
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
  });

  function makeCookies(
    wosSession?: string,
    cashierSession?: string
  ): Record<string, string> {
    const cookies: Record<string, string> = {};
    if (wosSession !== undefined) {
      cookies[SESSION_COOKIE_NAME] = wosSession;
    }
    if (cashierSession !== undefined) {
      cookies[CASHIER_SESSION_COOKIE_NAME] = cashierSession;
    }
    return cookies;
  }

  function makeRequest(
    wosSession?: string,
    cashierSession?: string
  ): MockRequest {
    return { cookies: makeCookies(wosSession, cashierSession) };
  }

  function makeResponse(): MockResponse {
    return { cookie: jest.fn() };
  }

  function makeAuthenticatedResult(
    overrides: { userId?: string; orgId?: string } = {}
  ) {
    return {
      authenticated: true as const,
      accessToken: "access.token",
      organizationId: overrides.orgId ?? "org_01",
      role: "admin",
      sessionId: "session_01",
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
      userId: overrides.userId ?? "user_01",
    };
  }

  // ── @Public() routes ───────────────────────────────────────────────────────

  describe("public routes — @Public()", () => {
    it("returns true without touching any session when handler is @Public()", async () => {
      mockGetAllAndOverride.mockReturnValueOnce(true);

      const { context } = makeHttpContext(makeRequest(), makeResponse());
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockAuthenticateSession).not.toHaveBeenCalled();
      expect(mockAuthenticateCashierSession).not.toHaveBeenCalled();
    });
  });

  // ── WorkOS session ─────────────────────────────────────────────────────────

  describe("WorkOS session (wos-session)", () => {
    it("returns true when wos-session is valid", async () => {
      mockGetAllAndOverride.mockReturnValueOnce(false);
      mockAuthenticateSession.mockResolvedValueOnce(makeAuthenticatedResult());

      const { context } = makeHttpContext(
        makeRequest("valid-session"),
        makeResponse()
      );
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockAuthenticateCashierSession).not.toHaveBeenCalled();
    });

    it("injects the authenticated session into request.user", async () => {
      mockGetAllAndOverride.mockReturnValueOnce(false);
      const sessionResult = makeAuthenticatedResult({ userId: "user_99" });
      mockAuthenticateSession.mockResolvedValueOnce(sessionResult);

      const request = makeRequest("valid-session");
      const { context } = makeHttpContext(request, makeResponse());

      await guard.canActivate(context);

      expect((request as unknown as { user: unknown }).user).toStrictEqual(
        sessionResult
      );
    });

    it("passes request and response through", async () => {
      mockGetAllAndOverride.mockReturnValueOnce(false);
      mockAuthenticateSession.mockResolvedValueOnce(makeAuthenticatedResult());

      const request = makeRequest("session");
      const response = makeResponse();
      const { context } = makeHttpContext(request, response);

      await guard.canActivate(context);

      expect(mockAuthenticateSession).toHaveBeenCalledWith(request, response);
    });
  });

  // ── Cashier session (fallback) ─────────────────────────────────────────────

  describe("cashier session fallback (cashier-session)", () => {
    it("tries cashier-session when wos-session is absent", async () => {
      mockGetAllAndOverride.mockReturnValueOnce(false);
      mockAuthenticateCashierSession.mockResolvedValueOnce(
        makeAuthenticatedResult({ userId: "cashier_01" })
      );

      const { context } = makeHttpContext(
        makeRequest(undefined, "cashier-id"),
        makeResponse()
      );
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockAuthenticateSession).not.toHaveBeenCalled();
      expect(mockAuthenticateCashierSession).toHaveBeenCalled();
    });

    it("injects cashier session into request.user", async () => {
      mockGetAllAndOverride.mockReturnValueOnce(false);
      const sessionResult = makeAuthenticatedResult({ userId: "cashier_01" });
      mockAuthenticateCashierSession.mockResolvedValueOnce(sessionResult);

      const request = makeRequest(undefined, "cashier-id");
      const { context } = makeHttpContext(request, makeResponse());

      await guard.canActivate(context);

      expect((request as unknown as { user: unknown }).user).toStrictEqual(
        sessionResult
      );
    });

    it("throws 401 when only cashier-session is present and it fails", async () => {
      mockGetAllAndOverride.mockReturnValueOnce(false);
      mockAuthenticateCashierSession.mockResolvedValueOnce({
        authenticated: false,
        reason: "cashier_auth_not_implemented",
      });

      const { context } = makeHttpContext(
        makeRequest(undefined, "bad-cashier"),
        makeResponse()
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("does not try cashier when wos-session succeeds", async () => {
      mockGetAllAndOverride.mockReturnValueOnce(false);
      mockAuthenticateSession.mockResolvedValueOnce(makeAuthenticatedResult());

      const { context } = makeHttpContext(
        makeRequest("valid", "also-present"),
        makeResponse()
      );

      await guard.canActivate(context);

      expect(mockAuthenticateCashierSession).not.toHaveBeenCalled();
    });

    it("tries cashier when wos-session cookie is present but invalid", async () => {
      mockGetAllAndOverride.mockReturnValueOnce(false);
      mockAuthenticateSession.mockResolvedValueOnce({
        authenticated: false,
        reason: "invalid_jwt",
      });
      mockAuthenticateCashierSession.mockResolvedValueOnce(
        makeAuthenticatedResult({ userId: "cashier_01" })
      );

      const { context } = makeHttpContext(
        makeRequest("expired", "cashier-id"),
        makeResponse()
      );
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockAuthenticateCashierSession).toHaveBeenCalled();
    });
  });

  // ── No session ─────────────────────────────────────────────────────────────

  describe("no session", () => {
    it("throws 401 when no cookie is present at all", async () => {
      mockGetAllAndOverride.mockReturnValueOnce(false);

      const { context } = makeHttpContext(makeRequest(), makeResponse());

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("does not call authenticateSession when no cookie is present", async () => {
      mockGetAllAndOverride.mockReturnValueOnce(false);

      const { context } = makeHttpContext(makeRequest(), makeResponse());

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException
      );

      expect(mockAuthenticateSession).not.toHaveBeenCalled();
      expect(mockAuthenticateCashierSession).not.toHaveBeenCalled();
    });
  });
});
