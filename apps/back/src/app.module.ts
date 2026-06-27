import { randomUUID } from "node:crypto";

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ApiResponseInterceptor } from "./common/interceptors/api-response.interceptor";
import { ZodValidationPipe } from "./common/pipes/zod-validation.pipe";
import { PrismaService } from "./lib/prisma.service";
import { AuthGuard } from "./middlewares/auth.guard";
import { authRoutes } from "./routes/auth.routes";
import { categoryRoutes } from "./routes/category.routes";
import { healthRoutes } from "./routes/health.routes";
import { productRoutes } from "./routes/product.routes";
import { saleRoutes } from "./routes/sale.routes";
import { tenantRoutes } from "./routes/tenant.routes";
import { userRoutes } from "./routes/user.routes";
import { webhookRoutes } from "./routes/webhook.routes";
import { AuthService } from "./services/auth.service";
import { CategoryService } from "./services/category.service";
import { ProductService } from "./services/product.service";
import { SaleService } from "./services/sale.service";
import { SessionRegistryService } from "./services/session-registry.service";
import { SessionService } from "./services/session.service";
import { SyncService } from "./services/sync.service";
import { TenantService } from "./services/tenant.service";
import { UserService } from "./services/user.service";

const isDev = process.env.NODE_ENV === "development";

@Module({
  controllers: [
    AppController,
    ...healthRoutes,
    ...authRoutes,
    ...webhookRoutes,
    ...userRoutes,
    ...tenantRoutes,
    ...productRoutes,
    ...categoryRoutes,
    ...saleRoutes,
  ],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: {
          ignore: (req) =>
            typeof req.url === "string" &&
            /^\/(?:health|ping|metrics|ready|live)/u.test(req.url),
        },
        genReqId: () => randomUUID(),
        level: process.env.LOG_LEVEL ?? "info",
        redact: [
          "req.headers.authorization",
          "req.headers.cookie",
          "password",
          "token",
        ],
        serializers: {
          req: (req) => ({
            method: req.method,
            url: req.url,
          }),
          res: (res) => ({
            responseTime: `${res.responseTime ?? 0}ms`,
            statusCode: res.statusCode,
          }),
        },
        ...(isDev
          ? {
              transport: {
                target: "pino-pretty",
              },
            }
          : {}),
      },
    }),
  ],
  providers: [
    AppService,
    AuthService,
    PrismaService,
    ProductService,
    CategoryService,
    SaleService,
    SessionRegistryService,
    SessionService,
    SyncService,
    TenantService,
    UserService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiResponseInterceptor,
    },
  ],
})
export class AppModule {}
