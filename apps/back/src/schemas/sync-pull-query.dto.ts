import { createZodDto } from "../common/validation/zod-dto";
import { SyncPullQuerySchema } from "./sync.schema";

export class SyncPullQueryDto extends createZodDto(SyncPullQuerySchema) {}
