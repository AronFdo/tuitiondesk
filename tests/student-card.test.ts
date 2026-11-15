import { describe, expect, it } from "vitest";
import { cardPayload, newCardToken, parseCardPayload } from "../lib/student-card";

describe("student card payload", () => {
  it("round-trips a token", () => {
    const token = newCardToken();
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect(parseCardPayload(cardPayload(token))).toBe(token);
  });

  it("tolerates whitespace and case changes from scanners", () => {
    const token = "0123456789abcdef0123456789abcdef";
    expect(parseCardPayload(`  td1:${token.toUpperCase()}\n`)).toBe(token);
  });

  it("turns away anything that is not a card", () => {
    expect(parseCardPayload("https://example.com")).toBeNull();
    expect(parseCardPayload("TD1:short")).toBeNull();
    expect(parseCardPayload("TD2:0123456789abcdef0123456789abcdef")).toBeNull();
  });
});
