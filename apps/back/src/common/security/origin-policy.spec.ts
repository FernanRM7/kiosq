import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { createCsrfOriginMiddleware } from "./origin-policy";

function createResponse() {
  const response = {
    json: jest.fn(),
    status: jest.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
}

function createRequest(options?: {
  method?: string;
  origin?: string;
  path?: string;
}) {
  return {
    get: jest.fn((header: string) =>
      header === "origin" ? options?.origin : undefined
    ),
    method: options?.method ?? "POST",
    originalUrl: options?.path ?? "/auth/logout",
    path: options?.path ?? "/auth/logout",
  };
}

describe("CSRF origin policy", () => {
  const middleware = createCsrfOriginMiddleware(["https://app.example.com"]);
  let next: jest.Mock;

  beforeEach(() => {
    next = jest.fn();
  });

  it("allows an exact configured origin", () => {
    const response = createResponse();

    middleware(
      createRequest({ origin: "https://app.example.com" }) as never,
      response as never,
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    "null",
    "not-a-url",
    "https://app.example.com.evil.test",
    "https://evil.test/?next=https://app.example.com",
  ])("rejects an unsafe origin value: %s", (origin) => {
    const response = createResponse();

    middleware(createRequest({ origin }) as never, response as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: "CSRF_ORIGIN_DENIED" }),
        success: false,
      })
    );
  });

  it.each(["GET", "HEAD", "OPTIONS"])(
    "allows safe %s requests without Origin",
    (method) => {
      const response = createResponse();

      middleware(createRequest({ method }) as never, response as never, next);

      expect(next).toHaveBeenCalledTimes(1);
    }
  );

  it("exempts only the signed WorkOS webhook path", () => {
    const response = createResponse();

    middleware(
      createRequest({ path: "/webhooks/workos" }) as never,
      response as never,
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
  });
});
