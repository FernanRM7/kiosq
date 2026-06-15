import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { SESSION_COOKIE_NAME } from "../constants/cookie.constants";
import { AuthService } from "../services/auth.service";
import { AuthController } from "./auth.controller";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeResponse() {
  return {
    cookie: jest.fn(),
    redirect: jest.fn(),
  };
}

const APP_URL = "http://localhost:5173";

const mockAuthService = {
  appUrl: APP_URL,
  exchangeCodeForSession: jest.fn(),
} as unknown as AuthService;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AuthController — GET /auth/callback", () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
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
      response as never
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

    await controller.callback("code", undefined, undefined, response as never);

    expect(response.redirect).toHaveBeenCalledWith(`${APP_URL}/dashboard`);
  });

  // ── WorkOS-side errors ────────────────────────────────────────────────────

  it("redirects to /login with WorkOS error when error param is present", async () => {
    const response = makeResponse();

    await controller.callback(
      undefined,
      "access_denied",
      "User cancelled",
      response as never
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
      response as never
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
      response as never
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
      response as never
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

    await controller.callback("code", undefined, undefined, response as never);

    const redirectArg: string = (response.redirect as jest.Mock).mock
      .calls[0][0] as string;
    expect(redirectArg).not.toContain(sensitiveMessage);
  });
});
