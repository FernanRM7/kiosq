import { createZodDto } from "../common/validation/zod-dto";
import { SupplierIdParamsSchema } from "./supplier.schema";

export class SupplierIdParamsDto extends createZodDto(SupplierIdParamsSchema) {}
