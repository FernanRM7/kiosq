import { Module } from "@nestjs/common";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { healthRoutes } from "./routes/health.routes";

@Module({
  controllers: [AppController, ...healthRoutes],
  imports: [],
  providers: [AppService],
})
export class AppModule {}
