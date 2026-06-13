import { Controller, Get, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { HealthResponseSchema } from "../schemas/health-response.schema";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    description: "Returns the current operational status of the service.",
    summary: "Health check",
  })
  @ApiResponse({
    description: "Service is operational.",
    status: HttpStatus.OK,
    type: HealthResponseSchema,
  })
  check(): HealthResponseSchema {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}
