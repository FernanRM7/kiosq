import { createZodDto } from "../common/validation/zod-dto";
import { UpdateTenantSchema } from "./tenant-dashboard.schema";

export class UpdateTenantDto extends createZodDto(UpdateTenantSchema) {}
