import { CashierLoginSchema } from "./cashier-auth.schema";

describe("CashierLoginSchema", () => {
  const validLogin = {
    cashierCode: "CJ-123456",
    pin: "123456",
    tenantSlug: "mi-tienda-2",
  };

  it("accepts canonical ASCII identifiers", () => {
    expect(CashierLoginSchema.safeParse(validLogin).success).toBe(true);
    expect(
      CashierLoginSchema.safeParse({
        ...validLogin,
        cashierCode: "cj-caja2",
        tenantSlug: "MI-TIENDA",
      }).success
    ).toBe(true);
  });

  it.each(["CJ-%", "CJ_1", "CJ\\1", "CJ--1", "-CJ1", "CJ1-"])(
    "rejects a non-canonical cashier code: %s",
    (cashierCode) => {
      expect(
        CashierLoginSchema.safeParse({ ...validLogin, cashierCode }).success
      ).toBe(false);
    }
  );

  it.each(["mi_tienda", "mi%tienda", "mi\u0000tienda", "-mi-tienda"])(
    "rejects a non-canonical tenant slug",
    (tenantSlug) => {
      expect(
        CashierLoginSchema.safeParse({ ...validLogin, tenantSlug }).success
      ).toBe(false);
    }
  );
});
