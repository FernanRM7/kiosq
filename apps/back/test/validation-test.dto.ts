import { z } from "zod";

import { createZodDto } from "../src/common/validation/zod-dto";

const validationBodySchema = z
  .object({
    name: z.string().min(1),
  })
  .strict();

const ValidationBodyDtoBase = createZodDto(validationBodySchema);

export class ValidationBodyDto extends ValidationBodyDtoBase {}
