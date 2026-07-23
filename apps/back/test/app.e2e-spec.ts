import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types";

import { AppModule } from "./../src/app.module";
import { setupApp } from "./../src/app.setup";
import { GlobalExceptionFilter } from "./../src/common/filters/global-exception.filter";
import { ValidationTestController } from "./validation-test.controller";

describe("AppController (e2e)", () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env.WORKOS_API_KEY ??= "sk_test";
    process.env.WORKOS_CLIENT_ID ??= "client_test";
    process.env.WORKOS_COOKIE_PASSWORD ??= "test_cookie_password_with_32_chars";

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ValidationTestController],
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    setupApp(app);
    await app.init();
  });

  it("/ (GET)", () =>
    request(app.getHttpServer())
      .get("/")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          data: "Hello World!",
          success: true,
        });
      }));

  it("sends global security headers", () =>
    request(app.getHttpServer())
      .get("/health")
      .expect(200)
      .expect("cache-control", "no-store")
      .expect("cross-origin-opener-policy", "same-origin")
      .expect("cross-origin-resource-policy", "same-origin")
      .expect("referrer-policy", "no-referrer")
      .expect("x-content-type-options", "nosniff")
      .expect(({ headers }) => {
        expect(headers["content-security-policy"]).toContain(
          "default-src 'self'"
        );
      }));

  it("wraps successful API responses consistently", () =>
    request(app.getHttpServer())
      .get("/health")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          data: {
            status: "ok",
            timestamp: expect.any(String),
          },
          success: true,
        });
      }));

  it("validates requests with global zod pipe", () =>
    request(app.getHttpServer())
      .post("/validation-test")
      .set("Origin", "http://localhost:5173")
      .send({ name: "Kiosq" })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          data: {
            name: "Kiosq",
          },
          success: true,
        });
      }));

  it("formats zod validation errors consistently", () =>
    request(app.getHttpServer())
      .post("/validation-test")
      .set("Origin", "http://localhost:5173")
      .send({ name: "" })
      .expect(400)
      .expect(({ body }) => {
        expect(body.success).toBe(false);
        expect(body.error).toMatchObject({
          code: "VALIDATION_ERROR",
          message: "Datos inválidos",
          path: "/validation-test",
          statusCode: 400,
        });
        expect(body.error.details).toEqual([
          expect.objectContaining({
            code: "too_small",
            path: "name",
          }),
        ]);
      }));

  it("blocks state-changing cross-site requests before the controller", () =>
    request(app.getHttpServer())
      .post("/validation-test")
      .set("Origin", "https://evil.example")
      .send({ name: "Kiosq" })
      .expect(403)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: {
            code: "CSRF_ORIGIN_DENIED",
            message: "El origen de la solicitud no está permitido",
            path: "/validation-test",
            statusCode: 403,
          },
          success: false,
        });
      }));

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });
});
