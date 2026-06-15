import { ApiProperty } from "@nestjs/swagger";

import { MeResponseSchema } from "./me-response.schema";

export class MeSuccessResponseSchema {
  @ApiProperty({
    description: "Indicates whether the request succeeded",
    example: true,
  })
  success: true;

  @ApiProperty({
    description: "Authenticated user profile payload",
    type: MeResponseSchema,
  })
  data: MeResponseSchema;
}
