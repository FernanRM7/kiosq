import { createZodDto } from "../common/validation/zod-dto";
import { ProductIdParamsSchema } from "./product.schema";

export class ProductIdParamsDto extends createZodDto(ProductIdParamsSchema) {}
