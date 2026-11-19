import { describe, expect, it } from "vitest";
import { cardPath, cardPayload, newCardToken, parseCardPayload } from "../lib/student-card";
import { safeNextPath } from "../lib/next-path";

const token = "0123456789abcdef0123456789abcdef";

describe("student card payload", () => {
  it("is a link to the card page that round-trips", () => {
    const fresh = newCardToken();
    expect(fresh).toMatch(/^[0-9a-f]{32}$/);
    expect(cardPayload(token, "https://app.tuitiondesk.lk/")).toBe(`https://app.tuitiondesk.lk/c/${token}`);
    expect(parseCardPayload(cardPayload(fresh, "https://app.tuitiondesk.lk"))).toBe(fresh);
    expect(cardPath(token)).toBe(`/c/${token}`);
  });

  it("still reads cards printed before links", () => {
    expect(parseCardPayload(`TD1:${token}`)).toBe(token);
    expect(parseCardPayload(`  td1:${token.toUpperCase()}\n`)).toBe(token);
  });

  it("tolerates whitespace and case changes from keyboard-mode scanners", () => {
    expect(parseCardPayload(`  HTTPS://APP.TUITIONDESK.LK/C/${token.toUpperCase()}\n`)).toBe(token);
    expect(parseCardPayload(`http://localhost:3000/c/${token}/`)).toBe(token);
  });

  it("turns away anything that is not a card", () => {
    expect(parseCardPayload("https://example.com")).toBeNull();
    expect(parseCardPayload(`https://example.com/c/${token}?x=1`)).toBeNull();
    expect(parseCardPayload(`https://example.com/students/${token}`)).toBeNull();
    expect(parseCardPayload(`https://example.com/c/${token}/extra`)).toBeNull();
    expect(parseCardPayload(`ftp://example.com/c/${token}`)).toBeNull();
    expect(parseCardPayload("TD1:short")).toBeNull();
    expect(parseCardPayload(`TD2:${token}`)).toBeNull();
  });
});

describe("safeNextPath", () => {
  it("keeps paths on this site and replaces the rest", () => {
    expect(safeNextPath(`/c/${token}`)).toBe(`/c/${token}`);
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard");
  });
});
