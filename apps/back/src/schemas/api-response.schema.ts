import { ApiProperty } from "@nestjs/swagger";

import { ApiErrorBodySchema } from "./api-error-body.schema";

export class ApiErrorResponseSchema {
  @ApiProperty({
    description: "Indicates whether the request succeeded",
    example: false,
    type: Boolean,
  })
  success: boolean;

  @ApiProperty({
    description: "Error response payload",
    type: ApiErrorBodySchema,
  })
  error: ApiErrorBodySchema;
}
