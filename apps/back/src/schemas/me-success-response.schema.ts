import { ApiProperty } from "@nestjs/swagger";

import { MeResponseSchema } from "./me-response.schema";

export class MeSuccessResponseSchema {
  @ApiProperty({
    description: "Indicates whether the request succeeded",
    example: true,
    type: Boolean,
  })
  success: boolean;

  @ApiProperty({
    description: "Authenticated user profile payload",
    type: MeResponseSchema,
  })
  data: MeResponseSchema;
}
