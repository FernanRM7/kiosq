import { ApiProperty } from "@nestjs/swagger";

import { SyncPushResponseSchema } from "./sync-push-response.schema";

export class SyncPushSuccessResponseSchema {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: SyncPushResponseSchema })
  data: SyncPushResponseSchema;
}
