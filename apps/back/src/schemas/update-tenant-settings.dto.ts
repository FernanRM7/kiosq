import { createZodDto } from "../common/validation/zod-dto";
import { UpdateTenantSettingsSchema } from "./tenant-dashboard.schema";

export class UpdateTenantSettingsDto extends createZodDto(
  UpdateTenantSettingsSchema
) {}
