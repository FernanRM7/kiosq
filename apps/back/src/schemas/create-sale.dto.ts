import { createZodDto } from "../common/validation/zod-dto";
import { CreateSaleSchema } from "./sale.schema";

export class CreateSaleDto extends createZodDto(CreateSaleSchema) {}
