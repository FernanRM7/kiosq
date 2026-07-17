import { Module } from "@nestjs/common";
// ConfigModule removed from AppModule to avoid runtime export validation error during dev.
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";

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
import { syncRoutes } from "./routes/sync.routes";
import { tenantRoutes } from "./routes/tenant.routes";
import { userRoutes } from "./routes/user.routes";
import { webhookRoutes } from "./routes/webhook.routes";
import { AuthService } from "./services/auth.service";
import { CategoryService } from "./services/category.service";
import { OfflineSyncService } from "./services/offline-sync.service";
import { ProductService } from "./services/product.service";
import { SaleService } from "./services/sale.service";
import { SessionRegistryService } from "./services/session-registry.service";
import { SessionService } from "./services/session.service";
import { SyncService } from "./services/sync.service";
import { TenantService } from "./services/tenant.service";
import { UserService } from "./services/user.service";

@Module({
  controllers: [
    AppController,
    // sync controller
    // the file is added under controllers/sync.controller.ts
    ...healthRoutes,
    ...authRoutes,
    ...webhookRoutes,
    ...userRoutes,
    ...tenantRoutes,
    ...productRoutes,
    ...categoryRoutes,
    ...saleRoutes,
    ...syncRoutes,
  ],
  imports: [],
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
    OfflineSyncService,
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
