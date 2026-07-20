import { createZodDto } from "../common/validation/zod-dto";
import { SyncPushSchema } from "./sync.schema";

export class SyncPushDto extends createZodDto(SyncPushSchema) {}
