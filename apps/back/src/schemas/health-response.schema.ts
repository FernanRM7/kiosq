import { ApiProperty } from "@nestjs/swagger";

export class HealthResponseSchema {
  @ApiProperty({
    description: "Operational status of the service",
    example: "ok",
    type: String,
  })
  status: string;

  @ApiProperty({
    description: "ISO 8601 timestamp of the response",
    example: "2026-06-13T08:00:00.000Z",
    type: String,
  })
  timestamp: string;
}
