import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext, INestApplication } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const supertestLib = require("supertest") as typeof import("supertest");

import { HttpExceptionFilter } from "../common/filters/http-exception.filter";
import { ApiResponseInterceptor } from "../common/interceptors/api-response.interceptor";
import { SESSION_COOKIE_NAME } from "../constants/cookie.constants";
import { AuthGuard } from "../middlewares/auth.guard";
import { AuthService } from "../services/auth.service";
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
} as unknown as SessionService;

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
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: SessionService, useValue: mockSessionService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it("returns authorizationUrl from AuthService", () => {
    const result = controller.login(undefined);

    expect(result.authorizationUrl).toBe(MOCK_AUTHORIZATION_URL);
  });

  it("calls getAuthorizationUrl with no options when params are absent", () => {
    controller.login(undefined);

    expect(mockAuthService.getAuthorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        state: undefined,
      })
    );
  });

  it("forwards state to getAuthorizationUrl", () => {
    controller.login("csrf_token_xyz");

    expect(mockAuthService.getAuthorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "csrf_token_xyz",
      })
    );
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
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: SessionService, useValue: mockSessionService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  // ── Successful flow ──────────────────────────────────────────────────────

  it("sets wos-session cookie and redirects to /dashboard on success", async () => {
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
      response as never,
      {} as never
    );

    expect(mockAuthService.exchangeCodeForSession).toHaveBeenCalledWith(
      "valid-code"
    );
    expect(response.cookie).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      "sealed-session-string",
      expect.objectContaining({ httpOnly: true })
    );
    expect(response.redirect).toHaveBeenCalledWith(`${APP_URL}/dashboard`);
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
      response as never,
      {} as never
    );

    expect(response.redirect).toHaveBeenCalledWith(`${APP_URL}/dashboard`);
  });

  // ── WorkOS-side errors ────────────────────────────────────────────────────

  it("redirects to /login with WorkOS error when error param is present", async () => {
    const response = makeResponse();

    await controller.callback(
      undefined,
      "access_denied",
      "User cancelled",
      response as never,
      {} as never
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
      response as never,
      {} as never
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
      response as never,
      {} as never
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
      response as never,
      {} as never
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
      response as never,
      {} as never
    );

    const redirectArg: string = (response.redirect as jest.Mock).mock
      .calls[0][0] as string;
    expect(redirectArg).not.toContain(sensitiveMessage);
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
        { provide: AuthService, useValue: mockAuthService },
        { provide: SessionService, useValue: mockSessionService },
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
        { provide: AuthService, useValue: mockAuthService },
        { provide: SessionService, useValue: mockSessionService },
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
        { provide: AuthService, useValue: mockAuthService },
        { provide: SessionService, useValue: mockSessionService },
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
