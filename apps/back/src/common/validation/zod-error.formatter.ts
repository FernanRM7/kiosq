import type { z } from "zod";

export const VALIDATION_ERROR_CODE = "VALIDATION_ERROR";
export const VALIDATION_ERROR_MESSAGE = "Validation failed";

export interface ZodValidationIssue {
  code: string;
  message: string;
  path: string;
}

export function formatZodIssues(
  issues: z.core.$ZodIssue[]
): ZodValidationIssue[] {
  return issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    path: issue.path.length > 0 ? issue.path.join(".") : "(root)",
  }));
}
