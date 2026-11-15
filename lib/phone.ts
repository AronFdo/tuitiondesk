export type PhoneResult =
  | { ok: true; e164: string | null }
  | { ok: false; reason: "incomplete" };

export function normalizePhone(input: string): PhoneResult {
  const compact = input.trim().replace(/[\s()-]/g, "");
  if (!compact) {
    return { ok: true, e164: null };
  }
  if (/^\+94\d{9}$/.test(compact)) {
    return { ok: true, e164: compact };
  }
  if (/^0\d{9}$/.test(compact)) {
    return { ok: true, e164: `+94${compact.slice(1)}` };
  }
  return { ok: false, reason: "incomplete" };
}
