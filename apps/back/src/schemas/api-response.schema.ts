import { ApiProperty } from "@nestjs/swagger";

import { ApiErrorBodySchema } from "./api-error-body.schema";

export class ApiErrorResponseSchema {
  @ApiProperty({
    description: "Indicates whether the request succeeded",
    example: false,
  })
  success: false;

  @ApiProperty({
    description: "Error response payload",
    type: ApiErrorBodySchema,
  })
  error: ApiErrorBodySchema;
}
