import { createZodDto } from "../common/validation/zod-dto";
import { UpdateCategorySchema } from "./category.schema";

export class UpdateCategoryDto extends createZodDto(UpdateCategorySchema) {}
