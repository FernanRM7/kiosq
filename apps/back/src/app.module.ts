import { Module } from "@nestjs/common";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { healthRoutes } from "./routes/health.routes";
import { AuthService } from "./services/auth.service";

@Module({
  controllers: [AppController, ...healthRoutes],
  imports: [],
  providers: [AppService, AuthService],
})
export class AppModule {}
