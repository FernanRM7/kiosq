import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { ExecutionContext, INestApplication } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const supertestLib = require("supertest") as typeof import("supertest");

import { HttpExceptionFilter } from "../common/filters/http-exception.filter";
import { ApiResponseInterceptor } from "../common/interceptors/api-response.interceptor";
import {
  OAUTH_STATE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "../constants/cookie.constants";
import { AuthGuard } from "../middlewares/auth.guard";
import { AuthService } from "../services/auth.service";
import { CashierSessionService } from "../services/cashier-session.service";
import { CashierService } from "../services/cashier.service";
import { SessionService } from "../services/session.service";
import { AuthController } from "./auth.controller";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

function makeResponse() {
  return {
    clearCookie: jest.fn(),
    cookie: jest.fn(),
    redirect: jest.fn(),
  };
}

const APP_URL = "http://localhost:5173";
const MOCK_SESSION_ID = "session_01";
const MOCK_LOGOUT_URL = "https://auth.workos.com/logout?token=abc123";
const OAUTH_STATE = "o".repeat(43);

function makeOAuthRequest() {
  return {
    cookies: {
      [OAUTH_STATE_COOKIE_NAME]: OAUTH_STATE,
    },
  };
}

const MOCK_SESSION = {
  accessToken: "access.token",
  authenticated: true as const,
  organizationId: "org_01",
  role: "admin",
  sessionId: MOCK_SESSION_ID,
  user: {
    email: "user@example.com",
    emailVerified: true,
    firstName: "Jane",
    id: "user_01",
    lastName: "Doe",
    name: "Jane Doe",
  },
  userId: "user_01",
};

const MOCK_AUTHORIZATION_URL =
  "https://auth.workos.com/oauth2/authorize?client_id=client_01&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback&response_type=code&provider=authkit";

const mockAuthService = {
  appUrl: APP_URL,
  exchangeCodeForSession: jest.fn(),
  getAuthorizationUrl: jest.fn().mockReturnValue(MOCK_AUTHORIZATION_URL),
  getLogoutUrl: jest.fn().mockReturnValue(MOCK_LOGOUT_URL),
} as unknown as AuthService;

const mockSessionService = {
  clearSession: jest.fn(),
  revokeSession: jest.fn(),
} as unknown as SessionService;

const mockCashierSessionService = {
  clearSessionCookie: jest.fn(),
  createSession: jest.fn(),
  revokeSession: jest.fn(),
  writeSessionCookie: jest.fn(),
} as unknown as CashierSessionService;

const mockCashierService = {
  authenticateCashierLogin: jest.fn(),
  closeCashierShift: jest.fn(),
  openCashierShift: jest.fn(),
  recordSuccessfulLogin: jest.fn(),
} as unknown as CashierService;

const authControllerProviders = [
  { provide: AuthService, useValue: mockAuthService },
  { provide: CashierSessionService, useValue: mockCashierSessionService },
  { provide: CashierService, useValue: mockCashierService },
  { provide: SessionService, useValue: mockSessionService },
];

// ─── GET /auth/login ─────────────────────────────────────────────────────────

describe("AuthController — GET /auth/login", () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest
      .mocked(mockAuthService.getAuthorizationUrl)
      .mockReturnValue(MOCK_AUTHORIZATION_URL);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: authControllerProviders,
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it("returns authorizationUrl from AuthService", () => {
    const result = controller.login(makeResponse() as never);

    expect(result.authorizationUrl).toBe(MOCK_AUTHORIZATION_URL);
  });

  it("generates and stores a server-owned one-time OAuth state", () => {
    const response = makeResponse();

    controller.login(response as never);

    expect(mockAuthService.getAuthorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        state: expect.stringMatching(/^[\w-]{43}$/u),
      })
    );
    const generatedState = jest.mocked(mockAuthService.getAuthorizationUrl).mock
      .calls[0]?.[0]?.state;
    expect(response.cookie).toHaveBeenCalledWith(
      OAUTH_STATE_COOKIE_NAME,
      generatedState,
      expect.objectContaining({
        httpOnly: true,
        maxAge: 600_000,
        path: "/",
        secure: true,
      })
    );
  });

  it("generates a different state for every login attempt", () => {
    const response = makeResponse();

    controller.login(response as never);
    controller.login(response as never);

    const firstState = jest.mocked(mockAuthService.getAuthorizationUrl).mock
      .calls[0]?.[0]?.state;
    const secondState = jest.mocked(mockAuthService.getAuthorizationUrl).mock
      .calls[1]?.[0]?.state;
    expect(firstState).not.toBe(secondState);
  });
});

// ─── POST /auth/cashier/login ───────────────────────────────────────────────

describe("AuthController — POST /auth/cashier/login", () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: authControllerProviders,
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it("persists the opaque session before writing the cashier cookie", async () => {
    jest
      .mocked(mockCashierService.authenticateCashierLogin)
      .mockResolvedValueOnce({
        cashier: {
          id: "cashier_01",
          name: "Caja Uno",
          pinHash: "bcrypt-hash",
          tenantId: "tenant_01",
          tenantSlug: "tienda",
        },
        openingCash: 500,
      });
    jest
      .mocked(mockCashierSessionService.createSession)
      .mockResolvedValueOnce("s".repeat(43));
    jest
      .mocked(mockCashierService.openCashierShift)
      .mockResolvedValueOnce(undefined);
    const response = makeResponse();

    const result = await controller.cashierLogin(
      {
        cashierCode: "CJ-123456",
        pin: "123456",
        tenantSlug: "tienda",
      },
      {
        headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
        ip: "127.0.0.1",
      } as never,
      response as never
    );

    expect(mockCashierService.authenticateCashierLogin).toHaveBeenCalledWith(
      expect.objectContaining({ cashierCode: "CJ-123456" }),
      "127.0.0.1"
    );
    expect(mockCashierSessionService.createSession).toHaveBeenCalledWith({
      pinHash: "bcrypt-hash",
      tenantId: "tenant_01",
      userId: "cashier_01",
    });
    expect(mockCashierService.openCashierShift).toHaveBeenCalledWith(
      "cashier_01"
    );
    expect(mockCashierService.recordSuccessfulLogin).toHaveBeenCalledWith(
      "cashier_01",
      "tenant_01"
    );
    expect(mockSessionService.clearSession).toHaveBeenCalledWith(
      response as never
    );
    expect(mockCashierSessionService.writeSessionCookie).toHaveBeenCalledWith(
      response as never,
      "s".repeat(43)
    );
    expect(result).toStrictEqual({
      redirectTo: `${APP_URL}/dashboard`,
    });
  });

  it("revokes the new session and does not write a cookie when shift opening fails", async () => {
    jest
      .mocked(mockCashierService.authenticateCashierLogin)
      .mockResolvedValueOnce({
        cashier: {
          id: "cashier_01",
          name: "Caja Uno",
          pinHash: "bcrypt-hash",
          tenantId: "tenant_01",
          tenantSlug: "tienda",
        },
        openingCash: 500,
      });
    jest
      .mocked(mockCashierSessionService.createSession)
      .mockResolvedValueOnce("s".repeat(43));
    jest
      .mocked(mockCashierService.openCashierShift)
      .mockRejectedValueOnce(new Error("shift unavailable"));
    jest
      .mocked(mockCashierSessionService.revokeSession)
      .mockResolvedValueOnce(undefined);
    const response = makeResponse();

    await expect(
      controller.cashierLogin(
        {
          cashierCode: "CJ-123456",
          pin: "123456",
          tenantSlug: "tienda",
        },
        { headers: {}, ip: "127.0.0.1" } as never,
        response as never
      )
    ).rejects.toThrow("shift unavailable");

    expect(mockCashierSessionService.revokeSession).toHaveBeenCalledWith(
      "s".repeat(43)
    );
    expect(mockCashierSessionService.writeSessionCookie).not.toHaveBeenCalled();
    expect(mockCashierService.recordSuccessfulLogin).not.toHaveBeenCalled();
  });
});

// ─── GET /auth/callback ───────────────────────────────────────────────────────

describe("AuthController — GET /auth/callback", () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.mocked(mockAuthService.getLogoutUrl).mockReturnValue(MOCK_LOGOUT_URL);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: authControllerProviders,
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  // ── Successful flow ──────────────────────────────────────────────────────

  it("sets wos-session cookie and redirects to onboarding on success", async () => {
    const response = makeResponse();

    jest.mocked(mockAuthService.exchangeCodeForSession).mockResolvedValueOnce({
      organizationId: "org_01",
      sealedSession: "sealed-session-string",
      userId: "user_01",
    });

    await controller.callback(
      "valid-code",
      undefined,
      undefined,
      OAUTH_STATE,
      response as never,
      makeOAuthRequest() as never
    );

    expect(mockAuthService.exchangeCodeForSession).toHaveBeenCalledWith(
      "valid-code"
    );
    expect(response.cookie).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      "sealed-session-string",
      expect.objectContaining({ httpOnly: true })
    );
    expect(response.redirect).toHaveBeenCalledWith(`${APP_URL}/onboarding`);
  });

  it("includes organizationId in success log (no-op if undefined)", async () => {
    const response = makeResponse();

    jest.mocked(mockAuthService.exchangeCodeForSession).mockResolvedValueOnce({
      organizationId: undefined,
      sealedSession: "sealed",
      userId: "user_02",
    });

    await controller.callback(
      "code",
      undefined,
      undefined,
      OAUTH_STATE,
      response as never,
      makeOAuthRequest() as never
    );

    expect(response.redirect).toHaveBeenCalledWith(`${APP_URL}/onboarding`);
  });

  // ── WorkOS-side errors ────────────────────────────────────────────────────

  it("redirects to /login with WorkOS error when error param is present", async () => {
    const response = makeResponse();

    await controller.callback(
      undefined,
      "access_denied",
      "User cancelled",
      OAUTH_STATE,
      response as never,
      makeOAuthRequest() as never
    );

    expect(mockAuthService.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.redirect).toHaveBeenCalledWith(
      expect.stringContaining(`${APP_URL}/login?error=access_denied`)
    );
  });

  it("uses error_description as fallback for unknown WorkOS error codes", async () => {
    const response = makeResponse();

    await controller.callback(
      undefined,
      "unknown_error_code",
      "Something went wrong on WorkOS",
      OAUTH_STATE,
      response as never,
      makeOAuthRequest() as never
    );

    expect(response.redirect).toHaveBeenCalledWith(
      expect.stringContaining(
        encodeURIComponent("Something went wrong on WorkOS")
      )
    );
  });

  // ── Missing code ──────────────────────────────────────────────────────────

  it("redirects to /login with missing_code when code is absent", async () => {
    const response = makeResponse();

    await controller.callback(
      undefined,
      undefined,
      undefined,
      OAUTH_STATE,
      response as never,
      makeOAuthRequest() as never
    );

    expect(mockAuthService.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.redirect).toHaveBeenCalledWith(
      expect.stringContaining(`${APP_URL}/login?error=missing_code`)
    );
  });

  // ── Exchange failures ─────────────────────────────────────────────────────

  it("redirects to /login with exchange_failed when exchangeCodeForSession throws", async () => {
    const response = makeResponse();

    jest
      .mocked(mockAuthService.exchangeCodeForSession)
      .mockRejectedValueOnce(new Error("invalid_grant — code already used"));

    await controller.callback(
      "used-code",
      undefined,
      undefined,
      OAUTH_STATE,
      response as never,
      makeOAuthRequest() as never
    );

    expect(response.cookie).not.toHaveBeenCalled();
    expect(response.redirect).toHaveBeenCalledWith(
      expect.stringContaining(`${APP_URL}/login?error=exchange_failed`)
    );
  });

  it("does not expose raw exchange error message to the browser", async () => {
    const response = makeResponse();
    const sensitiveMessage = "Internal WorkOS token secret leaked";

    jest
      .mocked(mockAuthService.exchangeCodeForSession)
      .mockRejectedValueOnce(new Error(sensitiveMessage));

    await controller.callback(
      "code",
      undefined,
      undefined,
      OAUTH_STATE,
      response as never,
      makeOAuthRequest() as never
    );

    const redirectArg: string = (response.redirect as jest.Mock).mock
      .calls[0][0] as string;
    expect(redirectArg).not.toContain(sensitiveMessage);
  });

  it("rejects missing, mismatched and replayed state before code exchange", async () => {
    const invalidCases = [
      { cookie: OAUTH_STATE, state: undefined },
      { cookie: OAUTH_STATE, state: "x".repeat(43) },
      { cookie: undefined, state: OAUTH_STATE },
    ];

    for (const invalidCase of invalidCases) {
      const response = makeResponse();
      const request = {
        cookies: invalidCase.cookie
          ? { [OAUTH_STATE_COOKIE_NAME]: invalidCase.cookie }
          : {},
      };

      await controller.callback(
        "code",
        undefined,
        undefined,
        invalidCase.state,
        response as never,
        request as never
      );

      expect(response.redirect).toHaveBeenCalledWith(
        expect.stringContaining(`${APP_URL}/login?error=invalid_state`)
      );
      expect(response.clearCookie).toHaveBeenCalledWith(
        OAUTH_STATE_COOKIE_NAME,
        expect.objectContaining({ path: "/" })
      );
    }

    expect(mockAuthService.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────

describe("AuthController — POST /auth/logout", () => {
  let app: INestApplication;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.mocked(mockAuthService.getLogoutUrl).mockReturnValue(MOCK_LOGOUT_URL);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        ...authControllerProviders,
        { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (ctx: ExecutionContext) => {
              ctx
                .switchToHttp()
                .getRequest<{ user: typeof MOCK_SESSION }>().user =
                MOCK_SESSION;
              return true;
            },
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // ── Successful logout ─────────────────────────────────────────────────────

  it("returns HTTP 200 on successful logout", async () => {
    await supertestLib(app.getHttpServer()).post("/auth/logout").expect(200);
  });

  it("returns success envelope with logoutUrl", async () => {
    const res = await supertestLib(app.getHttpServer())
      .post("/auth/logout")
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.logoutUrl).toBe(MOCK_LOGOUT_URL);
  });

  it("calls getLogoutUrl with the sessionId from the authenticated session", async () => {
    await supertestLib(app.getHttpServer()).post("/auth/logout");

    expect(mockAuthService.getLogoutUrl).toHaveBeenCalledWith(MOCK_SESSION_ID);
  });

  it("calls clearSession to remove the wos-session cookie", async () => {
    await supertestLib(app.getHttpServer()).post("/auth/logout");

    expect(mockSessionService.clearSession).toHaveBeenCalledTimes(1);
  });

  // ── Unauthenticated ───────────────────────────────────────────────────────

  it("returns HTTP 401 when no session cookie is present", async () => {
    // Rebuild app with a guard that rejects
    await app.close();

    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        ...authControllerProviders,
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: () => {
              throw new UnauthorizedException("Authentication required");
            },
          },
        },
      ],
    }).compile();

    const unauthApp = module.createNestApplication();
    unauthApp.useGlobalFilters(new HttpExceptionFilter());
    await unauthApp.init();

    await supertestLib(unauthApp.getHttpServer())
      .post("/auth/logout")
      .expect(401);

    await unauthApp.close();
  });

  it("does NOT call clearSession or getLogoutUrl when unauthenticated", async () => {
    await app.close();
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        ...authControllerProviders,
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: () => {
              throw new UnauthorizedException("Authentication required");
            },
          },
        },
      ],
    }).compile();

    const unauthApp = module.createNestApplication();
    unauthApp.useGlobalFilters(new HttpExceptionFilter());
    await unauthApp.init();

    await supertestLib(unauthApp.getHttpServer())
      .post("/auth/logout")
      .expect(401);

    expect(mockAuthService.getLogoutUrl).not.toHaveBeenCalled();
    expect(mockSessionService.clearSession).not.toHaveBeenCalled();

    await unauthApp.close();
  });
});

describe("AuthController — cashier logout", () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: authControllerProviders,
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it("closes the shift, revokes Redis and clears the cashier cookie", async () => {
    jest
      .mocked(mockCashierService.closeCashierShift)
      .mockResolvedValueOnce(null);
    jest
      .mocked(mockCashierSessionService.revokeSession)
      .mockResolvedValueOnce(undefined);
    const response = makeResponse();

    const result = await controller.logout(
      {
        ...MOCK_SESSION,
        authType: "cashier",
        role: "CASHIER",
        sessionId: "s".repeat(43),
      },
      response as never
    );

    expect(mockCashierService.closeCashierShift).toHaveBeenCalledWith(
      "user_01"
    );
    expect(mockCashierSessionService.revokeSession).toHaveBeenCalledWith(
      "s".repeat(43)
    );
    expect(mockCashierSessionService.clearSessionCookie).toHaveBeenCalledWith(
      response as never
    );
    expect(mockAuthService.getLogoutUrl).not.toHaveBeenCalled();
    expect(result).toStrictEqual({ logoutUrl: `${APP_URL}/login` });
  });

  it("still revokes and clears the session when shift close fails", async () => {
    jest
      .mocked(mockCashierService.closeCashierShift)
      .mockRejectedValueOnce(new Error("shift table unavailable"));
    jest
      .mocked(mockCashierSessionService.revokeSession)
      .mockResolvedValueOnce(undefined);
    const response = makeResponse();

    await controller.logout(
      {
        ...MOCK_SESSION,
        authType: "cashier",
        role: "CASHIER",
        sessionId: "s".repeat(43),
      },
      response as never
    );

    expect(mockCashierSessionService.revokeSession).toHaveBeenCalled();
    expect(mockCashierSessionService.clearSessionCookie).toHaveBeenCalled();
  });

  it("returns 503 and preserves the cookie when revocation cannot be confirmed", async () => {
    jest
      .mocked(mockCashierService.closeCashierShift)
      .mockResolvedValueOnce(null);
    jest
      .mocked(mockCashierSessionService.revokeSession)
      .mockRejectedValueOnce(new Error("Redis unavailable"));
    const response = makeResponse();

    await expect(
      controller.logout(
        {
          ...MOCK_SESSION,
          authType: "cashier",
          role: "CASHIER",
          sessionId: "s".repeat(43),
        },
        response as never
      )
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(mockCashierService.closeCashierShift).toHaveBeenCalled();
    expect(mockCashierSessionService.clearSessionCookie).not.toHaveBeenCalled();
  });
});
