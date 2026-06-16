import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { SESSION_COOKIE_NAME } from "../constants/cookie.constants";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { SessionService } from "../services/session.service";
import { AuthGuard } from "./auth.guard";

// ─── Mock factories ───────────────────────────────────────────────────────────

interface MockRequest {
  cookies: Record<string, string>;
  user?: unknown;
}

interface MockResponse {
  cookie: jest.Mock;
}

function makeHttpContext(
  request: MockRequest,
  response: MockResponse,
  handlerMetadata: boolean | undefined = undefined,
  classMetadata: boolean | undefined = undefined
) {
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

  return { context, cls, handler, handlerMetadata, classMetadata };
}

// ─── Test setup ───────────────────────────────────────────────────────────────

describe("AuthGuard", () => {
  let guard: AuthGuard;

  const mockAuthenticateSession = jest.fn();
  const mockGetAllAndOverride = jest.fn();

  const mockSessionService = {
    authenticateSession: mockAuthenticateSession,
  } as unknown as SessionService;

  const mockReflector = {
    getAllAndOverride: mockGetAllAndOverride,
  } as unknown as Reflector;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: SessionService, useValue: mockSessionService },
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
  });

  function makeRequest(cookieValue?: string): MockRequest {
    return {
      cookies: cookieValue ? { [SESSION_COOKIE_NAME]: cookieValue } : {},
    };
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
        id: overrides.userId ?? "user_01",
        email: "user@example.com",
        emailVerified: true,
        firstName: "Test",
        lastName: "User",
      },
      userId: overrides.userId ?? "user_01",
    };
  }

  // ── @Public() routes ───────────────────────────────────────────────────────

  describe("public routes — @Public()", () => {
    it("returns true without touching the session when handler is @Public()", async () => {
      mockGetAllAndOverride.mockReturnValueOnce(true);

      const request = makeRequest();
      const { context } = makeHttpContext(request, makeResponse());

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockAuthenticateSession).not.toHaveBeenCalled();
    });

    it("returns true without touching the session when class is @Public()", async () => {
      mockGetAllAndOverride.mockReturnValueOnce(true);

      const { context } = makeHttpContext(makeRequest(), makeResponse());

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockAuthenticateSession).not.toHaveBeenCalled();
    });

    it("reads IS_PUBLIC_KEY from both handler and class (priority order)", async () => {
      mockGetAllAndOverride.mockReturnValueOnce(false);
      mockAuthenticateSession.mockResolvedValueOnce(makeAuthenticatedResult());

      const request = makeRequest("session");
      const { context, handler, cls } = makeHttpContext(
        request,
        makeResponse()
      );

      await guard.canActivate(context);

      expect(mockGetAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

      // Verify handler and class references match what the context provides
      expect(context.getHandler()).toBe(handler);
      expect(context.getClass()).toBe(cls);
    });
  });

  // ── Protected routes — valid session ──────────────────────────────────────

  describe("protected routes — valid session", () => {
    it("returns true when session is valid", async () => {
      mockGetAllAndOverride.mockReturnValueOnce(false);
      mockAuthenticateSession.mockResolvedValueOnce(makeAuthenticatedResult());

      const { context } = makeHttpContext(
        makeRequest("valid-session"),
        makeResponse()
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("injects the authenticated session result into request.user", async () => {
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

    it("passes the request and response to authenticateSession", async () => {
      mockGetAllAndOverride.mockReturnValueOnce(false);
      mockAuthenticateSession.mockResolvedValueOnce(makeAuthenticatedResult());

      const request = makeRequest("session");
      const response = makeResponse();
      const { context } = makeHttpContext(request, response);

      await guard.canActivate(context);

      expect(mockAuthenticateSession).toHaveBeenCalledWith(request, response);
    });
  });

  // ── Protected routes — invalid / missing session ──────────────────────────

  describe("protected routes — unauthorized", () => {
    it("throws UnauthorizedException when session is invalid", async () => {
      mockGetAllAndOverride.mockReturnValueOnce(false);
      mockAuthenticateSession.mockResolvedValueOnce({
        authenticated: false,
        reason: "session_revoked",
      });

      const { context } = makeHttpContext(
        makeRequest("bad-session"),
        makeResponse()
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("throws UnauthorizedException when no cookie is present", async () => {
      mockGetAllAndOverride.mockReturnValueOnce(false);
      mockAuthenticateSession.mockResolvedValueOnce({
        authenticated: false,
        reason: "no_session_cookie_provided",
      });

      const { context } = makeHttpContext(makeRequest(), makeResponse());

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("does NOT inject request.user when session validation fails", async () => {
      mockGetAllAndOverride.mockReturnValueOnce(false);
      mockAuthenticateSession.mockResolvedValueOnce({
        authenticated: false,
        reason: "invalid_jwt",
      });

      const request = makeRequest("expired");
      const { context } = makeHttpContext(request, makeResponse());

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException
      );

      expect((request as unknown as { user?: unknown }).user).toBeUndefined();
    });
  });
});
