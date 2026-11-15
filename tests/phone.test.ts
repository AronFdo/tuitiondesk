import { describe, expect, it } from "vitest";
import { normalizePhone } from "../lib/phone";

describe("normalizePhone", () => {
  it("turns a local Sri Lankan number into E.164", () => {
    expect(normalizePhone("0771234567")).toEqual({
      ok: true,
      e164: "+94771234567",
    });
  });

  it("keeps an E.164 number", () => {
    expect(normalizePhone("+94771234567")).toEqual({
      ok: true,
      e164: "+94771234567",
    });
  });

  it("ignores spaces and hyphens", () => {
    expect(normalizePhone("077 123-4567")).toEqual({
      ok: true,
      e164: "+94771234567",
    });
  });

  it("treats a blank value as no phone", () => {
    expect(normalizePhone("   ")).toEqual({ ok: true, e164: null });
  });

  it("rejects an incomplete number", () => {
    expect(normalizePhone("077123")).toEqual({
      ok: false,
      reason: "incomplete",
    });
  });
});
