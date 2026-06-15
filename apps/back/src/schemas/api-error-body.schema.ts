import { ApiProperty } from "@nestjs/swagger";

export class ApiErrorBodySchema {
  @ApiProperty({
    description: "Stable error code for clients",
    example: "VALIDATION_ERROR",
  })
  code: string;

  @ApiProperty({
    description: "Human-readable error message",
    example: "Validation failed",
  })
  message: string;

  @ApiProperty({
    description: "Optional machine-readable details",
    example: [
      {
        code: "too_small",
        message: "Too small: expected string to have >=1 characters",
        path: "name",
      },
    ],
    required: false,
  })
  details?: unknown;

  @ApiProperty({
    description: "Request path where the error occurred",
    example: "/health",
    required: false,
  })
  path?: string;

  @ApiProperty({
    description: "HTTP status code",
    example: 400,
    required: false,
  })
  statusCode?: number;

  @ApiProperty({
    description: "ISO 8601 timestamp of the error response",
    example: "2026-06-13T08:00:00.000Z",
    required: false,
  })
  timestamp?: string;
}
