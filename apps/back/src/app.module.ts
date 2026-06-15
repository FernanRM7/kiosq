import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ApiResponseInterceptor } from "./common/interceptors/api-response.interceptor";
import { ZodValidationPipe } from "./common/pipes/zod-validation.pipe";
import { AuthGuard } from "./middlewares/auth.guard";
import { healthRoutes } from "./routes/health.routes";
import { userRoutes } from "./routes/user.routes";
import { AuthService } from "./services/auth.service";
import { SessionService } from "./services/session.service";
import { UserService } from "./services/user.service";

@Module({
  controllers: [AppController, ...healthRoutes, ...userRoutes],
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [
    AppService,
    AuthService,
    SessionService,
    UserService,
    AuthGuard,
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
