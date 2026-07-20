import { createZodDto } from "../common/validation/zod-dto";
import { CashierLoginSchema } from "./cashier-auth.schema";

export class CashierLoginDto extends createZodDto(CashierLoginSchema) {}
