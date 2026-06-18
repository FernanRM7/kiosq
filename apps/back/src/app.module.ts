import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ApiResponseInterceptor } from "./common/interceptors/api-response.interceptor";
import { ZodValidationPipe } from "./common/pipes/zod-validation.pipe";
import { PrismaService } from "./lib/prisma.service";
import { AuthGuard } from "./middlewares/auth.guard";
import { authRoutes } from "./routes/auth.routes";
import { healthRoutes } from "./routes/health.routes";
import { productRoutes } from "./routes/product.routes";
import { tenantRoutes } from "./routes/tenant.routes";
import { userRoutes } from "./routes/user.routes";
import { webhookRoutes } from "./routes/webhook.routes";
import { AuthService } from "./services/auth.service";
import { ProductService } from "./services/product.service";
import { SessionRegistryService } from "./services/session-registry.service";
import { SessionService } from "./services/session.service";
import { SyncService } from "./services/sync.service";
import { TenantService } from "./services/tenant.service";
import { UserService } from "./services/user.service";

@Module({
  controllers: [
    AppController,
    ...healthRoutes,
    ...authRoutes,
    ...webhookRoutes,
    ...userRoutes,
    ...tenantRoutes,
    ...productRoutes,
  ],
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [
    AppService,
    AuthService,
    PrismaService,
    ProductService,
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
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
