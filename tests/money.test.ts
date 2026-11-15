import { describe, expect, it } from "vitest";
import { formatLkr, minorToLkrInput, parseLkrToMinor } from "../lib/money";

describe("parseLkrToMinor", () => {
  it("turns rupees into minor units", () => {
    expect(parseLkrToMinor("12500")).toEqual({ ok: true, minor: 1_250_000 });
  });

  it("accepts commas and cents", () => {
    expect(parseLkrToMinor("12,500.50")).toEqual({ ok: true, minor: 1_250_050 });
  });

  it("treats a blank fee as zero", () => {
    expect(parseLkrToMinor("  ")).toEqual({ ok: true, minor: 0 });
  });

  it("rejects text", () => {
    expect(parseLkrToMinor("abc")).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("formatLkr", () => {
  it("drops cents when the amount is whole rupees", () => {
    expect(formatLkr(1_250_000)).toBe("LKR 12,500");
  });

  it("keeps cents when they are present", () => {
    expect(formatLkr(1_250_050)).toBe("LKR 12,500.50");
  });
});

describe("minorToLkrInput", () => {
  it("fills the fee field with rupees", () => {
    expect(minorToLkrInput(1_250_000)).toBe("12500");
    expect(minorToLkrInput(1_250_050)).toBe("12500.50");
    expect(minorToLkrInput(0)).toBe("");
  });
});
