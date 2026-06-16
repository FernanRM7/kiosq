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
// supertest requires a CJS-compatible import in this ts-jest setup
// eslint-disable-next-line @typescript-eslint/no-require-imports
const supertestLib = require("supertest") as typeof import("supertest");

import { HttpExceptionFilter } from "../common/filters/http-exception.filter";
import { ApiResponseInterceptor } from "../common/interceptors/api-response.interceptor";
import { AuthGuard } from "../middlewares/auth.guard";
import { UserService } from "../services/user.service";
import { UserController } from "./user.controller";

// ─── Shared fixture ───────────────────────────────────────────────────────────

const MOCK_SESSION = {
  accessToken: "access.token",
  authenticated: true as const,
  organizationId: "org_01",
  role: "admin",
  sessionId: "session_01",
  user: {
    email: "user@example.com",
    emailVerified: true,
    firstName: "Jane",
    id: "user_01",
    lastName: "Doe",
  },
  userId: "user_01",
};

const MOCK_ME_RESPONSE = {
  email: "user@example.com",
  emailVerified: true,
  firstName: "Jane",
  id: "user_01",
  lastName: "Doe",
  organizationId: "org_01",
  role: "admin",
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("UserController — GET /me", () => {
  let app: INestApplication;

  const mockUserService = {
    buildMeResponse: jest.fn().mockReturnValue(MOCK_ME_RESPONSE),
  };

  // ── Authenticated request ──────────────────────────────────────────────────

  describe("authenticated user", () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      mockUserService.buildMeResponse.mockReturnValue(MOCK_ME_RESPONSE);

      const module: TestingModule = await Test.createTestingModule({
        controllers: [UserController],
        providers: [
          { provide: UserService, useValue: mockUserService },
          { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
          {
            provide: APP_GUARD,
            useValue: {
              canActivate: (ctx: ExecutionContext) => {
                // Simulate what AuthGuard does: inject session into request.user
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
      await app.init();
    });

    afterEach(async () => {
      await app.close();
    });

    it("returns HTTP 200", async () => {
      await supertestLib(app.getHttpServer()).get("/me").expect(200);
    });

    it("returns success envelope with user data", async () => {
      const res = await supertestLib(app.getHttpServer())
        .get("/me")
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it("returns the correct user id", async () => {
      const res = await supertestLib(app.getHttpServer()).get("/me");
      expect(res.body.data.id).toBe("user_01");
    });

    it("returns the correct email address", async () => {
      const res = await supertestLib(app.getHttpServer()).get("/me");
      expect(res.body.data.email).toBe("user@example.com");
    });

    it("returns emailVerified claim", async () => {
      const res = await supertestLib(app.getHttpServer()).get("/me");
      expect(res.body.data.emailVerified).toBe(true);
    });

    it("returns the active organizationId claim", async () => {
      const res = await supertestLib(app.getHttpServer()).get("/me");
      expect(res.body.data.organizationId).toBe("org_01");
    });

    it("returns the RBAC role claim", async () => {
      const res = await supertestLib(app.getHttpServer()).get("/me");
      expect(res.body.data.role).toBe("admin");
    });

    it("calls buildMeResponse with the session injected by @CurrentUser()", async () => {
      await supertestLib(app.getHttpServer()).get("/me");

      expect(mockUserService.buildMeResponse).toHaveBeenCalledTimes(1);
      expect(mockUserService.buildMeResponse).toHaveBeenCalledWith(
        MOCK_SESSION
      );
    });

    it("returns firstName and lastName", async () => {
      const res = await supertestLib(app.getHttpServer()).get("/me");
      expect(res.body.data.firstName).toBe("Jane");
      expect(res.body.data.lastName).toBe("Doe");
    });
  });

  // ── Unauthenticated request ────────────────────────────────────────────────

  describe("unauthenticated user", () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [UserController],
        providers: [
          { provide: UserService, useValue: mockUserService },
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

      app = module.createNestApplication();
      app.useGlobalFilters(new HttpExceptionFilter());
      await app.init();
    });

    afterEach(async () => {
      await app.close();
    });

    it("returns HTTP 401 when no session cookie is present", async () => {
      await supertestLib(app.getHttpServer()).get("/me").expect(401);
    });

    it("does NOT call buildMeResponse when authentication fails", async () => {
      jest.clearAllMocks();

      await supertestLib(app.getHttpServer()).get("/me").expect(401);

      expect(mockUserService.buildMeResponse).not.toHaveBeenCalled();
    });
  });
});
