import { ApiProperty } from "@nestjs/swagger";

import { SyncPullResponseSchema } from "./sync-pull-response.schema";

export class SyncPullSuccessResponseSchema {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: SyncPullResponseSchema })
  data: SyncPullResponseSchema;
}
