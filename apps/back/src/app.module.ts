import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthGuard } from "./middlewares/auth.guard";
import { healthRoutes } from "./routes/health.routes";
import { userRoutes } from "./routes/user.routes";
import { AuthService } from "./services/auth.service";
import { SessionService } from "./services/session.service";
import { UserService } from "./services/user.service";

@Module({
  controllers: [AppController, ...healthRoutes, ...userRoutes],
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [AppService, AuthService, SessionService, UserService, AuthGuard],
})
export class AppModule {}
