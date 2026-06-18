import { createZodDto } from "../common/validation/zod-dto";
import { CreateProductSchema } from "./product.schema";

export class CreateProductDto extends createZodDto(CreateProductSchema) {}
