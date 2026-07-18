import { createZodDto } from "../common/validation/zod-dto";
import { CreateSupplierSchema } from "./supplier.schema";

export class CreateSupplierDto extends createZodDto(CreateSupplierSchema) {}
