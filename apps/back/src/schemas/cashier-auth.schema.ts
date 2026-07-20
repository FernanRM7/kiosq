import { z } from "zod";

const CASHIER_LOGIN_GENERIC_MESSAGE =
  "Completa los datos para iniciar sesión como cajero";

export const CashierLoginSchema = z.object({
  cashierCode: z
    .string()
    .trim()
    .min(3, CASHIER_LOGIN_GENERIC_MESSAGE)
    .max(32, CASHIER_LOGIN_GENERIC_MESSAGE),
  pin: z
    .string()
    .trim()
    .min(4, CASHIER_LOGIN_GENERIC_MESSAGE)
    .max(12, CASHIER_LOGIN_GENERIC_MESSAGE),
  tenantSlug: z
    .string()
    .trim()
    .min(2, CASHIER_LOGIN_GENERIC_MESSAGE)
    .max(120, CASHIER_LOGIN_GENERIC_MESSAGE),
});

export type CashierLoginInput = z.infer<typeof CashierLoginSchema>;
