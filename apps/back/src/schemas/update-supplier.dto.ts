import { createZodDto } from "../common/validation/zod-dto";
import { UpdateSupplierSchema } from "./supplier.schema";

export class UpdateSupplierDto extends createZodDto(UpdateSupplierSchema) {}
