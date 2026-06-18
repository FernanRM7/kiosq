import { createZodDto } from "../common/validation/zod-dto";
import { UpdateProductSchema } from "./product.schema";

export class UpdateProductDto extends createZodDto(UpdateProductSchema) {}
