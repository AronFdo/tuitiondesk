// Plain formatting for printed receipts, shared by the print page and the
// lists that show receipt numbers.

export type PaperWidth = 58 | 80;

// Thermal heads print a little narrower than the roll.
export const PRINTABLE_MM: Record<PaperWidth, number> = { 58: 48, 80: 72 };

export function paperWidth(value: number | null | undefined): PaperWidth {
  return value === 58 ? 58 : 80;
}

// "000123": fixed width so receipt numbers line up and sort as text.
export function formatReceiptNo(receiptNo: number) {
  return String(receiptNo).padStart(6, "0");
}

// "6,500.00": receipts always show cents, unlike the rest of the app.
export function receiptAmount(minor: number) {
  const whole = Math.floor(Math.abs(minor) / 100).toLocaleString("en-US");
  const cents = String(Math.abs(minor) % 100).padStart(2, "0");
  return `${minor < 0 ? "-" : ""}${whole}.${cents}`;
}
