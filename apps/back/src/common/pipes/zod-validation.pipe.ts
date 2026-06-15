import { BadRequestException, Injectable } from "@nestjs/common";
import type { ArgumentMetadata, PipeTransform } from "@nestjs/common";

import { getZodSchema } from "../validation/zod-dto";
import {
  formatZodIssues,
  VALIDATION_ERROR_CODE,
  VALIDATION_ERROR_MESSAGE,
} from "../validation/zod-error.formatter";

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (
      !this.shouldValidate(metadata) ||
      value === null ||
      value === undefined
    ) {
      return value;
    }

    const schema = getZodSchema(metadata.metatype);

    if (!schema) {
      return value;
    }

    const result = schema.safeParse(value);

    if (result.success) {
      return result.data;
    }

    throw new BadRequestException({
      code: VALIDATION_ERROR_CODE,
      details: formatZodIssues(result.error.issues),
      message: VALIDATION_ERROR_MESSAGE,
    });
  }

  private shouldValidate(metadata: ArgumentMetadata): boolean {
    return (
      metadata.type === "body" ||
      metadata.type === "query" ||
      metadata.type === "param"
    );
  }
}
