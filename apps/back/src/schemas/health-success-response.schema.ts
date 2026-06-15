import { ApiProperty } from "@nestjs/swagger";

import { HealthResponseSchema } from "./health-response.schema";

export class HealthSuccessResponseSchema {
  @ApiProperty({
    description: "Indicates whether the request succeeded",
    example: true,
  })
  success: true;

  @ApiProperty({
    description: "Health response payload",
    type: HealthResponseSchema,
  })
  data: HealthResponseSchema;
}
