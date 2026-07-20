import { describe, expect, it } from "@jest/globals";

import { buildUserLookup } from "./user.lib";

describe("buildUserLookup", () => {
  it("creates a where clause with OR matching workosUserId and id", () => {
    const result = buildUserLookup("some-user-id", {});
    expect(result.where).toEqual({
      OR: [{ workosUserId: "some-user-id" }, { id: "some-user-id" }],
    });
  });

  it("preserves select when passed", () => {
    const result = buildUserLookup<{ select: { role: true } }>("uid", {
      select: { role: true },
    });

    if (!("select" in result && result.select !== undefined)) {
      throw new Error("Expected select to be present");
    }

    expect(result.select).toEqual({ role: true });
  });

  it("preserves include when passed", () => {
    const result = buildUserLookup<{ include: { tenant: true } }>("uid", {
      include: { tenant: true },
    });

    if (!("include" in result && result.include !== undefined)) {
      throw new Error("Expected include to be present");
    }

    expect(result.include).toEqual({ tenant: true });
  });
});
