import { createZodDto } from "../common/validation/zod-dto";
import { DeleteTenantSchema } from "./tenant-dashboard.schema";

export class DeleteTenantDto extends createZodDto(DeleteTenantSchema) {}
