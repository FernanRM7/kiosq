import type { z } from "zod";

export interface ZodDtoClass<TSchema extends z.ZodType = z.ZodType> {
  new (): z.infer<TSchema>;
  readonly zodSchema: TSchema;
}

interface ZodSchemaHolder {
  readonly zodSchema?: z.ZodType;
}

export function createZodDto<TSchema extends z.ZodType>(
  schema: TSchema
): ZodDtoClass<TSchema> {
  class ZodDto {
    readonly _zodDtoBrand!: z.infer<TSchema>;

    static readonly zodSchema = schema;
  }

  return ZodDto as ZodDtoClass<TSchema>;
}

export function getZodSchema(metatype: unknown): z.ZodType | undefined {
  if (typeof metatype !== "function") {
    return;
  }

  const schema = (metatype as unknown as ZodSchemaHolder).zodSchema;

  if (!schema || typeof schema.safeParse !== "function") {
    return;
  }

  return schema;
}
