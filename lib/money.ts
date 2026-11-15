export type MoneyResult =
  | { ok: true; minor: number }
  | { ok: false; reason: "invalid" };

export function parseLkrToMinor(input: string): MoneyResult {
  const cleaned = input.trim().replace(/,/g, "");
  if (!cleaned) {
    return { ok: true, minor: 0 };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return { ok: false, reason: "invalid" };
  }
  const [whole, fraction = ""] = cleaned.split(".");
  const cents = Number(`${fraction}00`.slice(0, 2));
  return { ok: true, minor: Number(whole) * 100 + cents };
}

export function minorToLkrInput(minor: number): string {
  if (minor <= 0) {
    return "";
  }
  const whole = Math.floor(minor / 100);
  const cents = minor % 100;
  if (cents === 0) {
    return String(whole);
  }
  return `${whole}.${String(cents).padStart(2, "0")}`;
}

export function formatLkr(minor: number): string {
  const negative = minor < 0;
  const absolute = Math.abs(minor);
  const whole = Math.floor(absolute / 100);
  const cents = absolute % 100;
  const grouped = whole.toLocaleString("en-US");
  const amount =
    cents === 0 ? grouped : `${grouped}.${String(cents).padStart(2, "0")}`;
  return `${negative ? "-" : ""}LKR ${amount}`;
}
