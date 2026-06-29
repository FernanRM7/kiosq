import { createZodDto } from "../common/validation/zod-dto";
import { CreateCategorySchema } from "./category.schema";

export class CreateCategoryDto extends createZodDto(CreateCategorySchema) {}
