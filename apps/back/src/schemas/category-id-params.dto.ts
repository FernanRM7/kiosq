import { createZodDto } from "../common/validation/zod-dto";
import { CategoryIdParamsSchema } from "./category.schema";

export class CategoryIdParamsDto extends createZodDto(CategoryIdParamsSchema) {}
