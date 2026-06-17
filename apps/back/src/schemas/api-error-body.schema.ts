import { ApiProperty } from "@nestjs/swagger";

export class ApiErrorBodySchema {
  @ApiProperty({
    description: "Stable error code for clients",
    example: "VALIDATION_ERROR",
    type: String,
  })
  code: string;

  @ApiProperty({
    description: "Human-readable error message",
    example: "Validation failed",
    type: String,
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
    type: Object,
  })
  details?: unknown;

  @ApiProperty({
    description: "Request path where the error occurred",
    example: "/health",
    required: false,
    type: String,
  })
  path?: string;

  @ApiProperty({
    description: "HTTP status code",
    example: 400,
    required: false,
    type: Number,
  })
  statusCode?: number;

  @ApiProperty({
    description: "ISO 8601 timestamp of the error response",
    example: "2026-06-13T08:00:00.000Z",
    required: false,
    type: String,
  })
  timestamp?: string;
}
