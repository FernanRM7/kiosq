import { createZodDto } from "../common/validation/zod-dto";
import { CreateTenantSchema } from "./tenant-dashboard.schema";

export class CreateTenantDto extends createZodDto(CreateTenantSchema) {}
