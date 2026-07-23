import { z } from "zod";

const CASHIER_LOGIN_GENERIC_MESSAGE =
  "Completa los datos para iniciar sesión como cajero";

export const CASHIER_CODE_PATTERN = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/u;
export const TENANT_SLUG_PATTERN = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/u;

export const CashierLoginSchema = z.object({
  cashierCode: z
    .string()
    .trim()
    .min(3, CASHIER_LOGIN_GENERIC_MESSAGE)
    .max(20, CASHIER_LOGIN_GENERIC_MESSAGE)
    .regex(CASHIER_CODE_PATTERN, CASHIER_LOGIN_GENERIC_MESSAGE),
  pin: z
    .string()
    .trim()
    .regex(/^\d{4,6}$/u, CASHIER_LOGIN_GENERIC_MESSAGE),
  tenantSlug: z
    .string()
    .trim()
    .min(1, CASHIER_LOGIN_GENERIC_MESSAGE)
    .max(120, CASHIER_LOGIN_GENERIC_MESSAGE)
    .regex(TENANT_SLUG_PATTERN, CASHIER_LOGIN_GENERIC_MESSAGE),
});

export type CashierLoginInput = z.infer<typeof CashierLoginSchema>;
