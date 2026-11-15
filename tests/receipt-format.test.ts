import { describe, expect, it } from "vitest";
import { formatReceiptNo, paperWidth, receiptAmount } from "../lib/receipt-format";

describe("receipt formatting", () => {
  it("pads receipt numbers to six digits", () => {
    expect(formatReceiptNo(1)).toBe("000001");
    expect(formatReceiptNo(123456)).toBe("123456");
    expect(formatReceiptNo(1234567)).toBe("1234567");
  });

  it("shows amounts with cents and thousands separators", () => {
    expect(receiptAmount(650000)).toBe("6,500.00");
    expect(receiptAmount(1250050)).toBe("12,500.50");
    expect(receiptAmount(5)).toBe("0.05");
  });

  it("falls back to 80 mm paper", () => {
    expect(paperWidth(58)).toBe(58);
    expect(paperWidth(80)).toBe(80);
    expect(paperWidth(null)).toBe(80);
    expect(paperWidth(100)).toBe(80);
  });
});
