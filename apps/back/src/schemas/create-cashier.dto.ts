import { createZodDto } from "../common/validation/zod-dto";
import { CreateCashierSchema } from "./tenant-dashboard.schema";

export class CreateCashierDto extends createZodDto(CreateCashierSchema) {}
