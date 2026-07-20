import { createZodDto } from "../common/validation/zod-dto";
import { UpdateCashierSchema } from "./tenant-dashboard.schema";

export class UpdateCashierDto extends createZodDto(UpdateCashierSchema) {}
