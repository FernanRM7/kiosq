import { ApiProperty } from "@nestjs/swagger";

export class UnauthorizedResponseSchema {
  @ApiProperty({
    description: "HTTP status code",
    example: 401,
  })
  statusCode: number;

  @ApiProperty({
    description: "Error message",
    example: "Authentication required",
  })
  message: string;

  @ApiProperty({
    description: "Error type",
    example: "Unauthorized",
  })
  error: string;
}
