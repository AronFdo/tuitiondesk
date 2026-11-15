// What a student's card QR code carries: a version prefix and the student's
// random token. Nothing personal goes in the code, so a lost card gives away
// nothing and reissuing it (a new token) makes the old one useless.

const PREFIX = "TD1:";
const TOKEN = /^[0-9a-f]{32}$/;

export function cardPayload(qrToken: string) {
  return `${PREFIX}${qrToken}`;
}

// The token from a scanned code, or null for anything that is not one of our
// cards. Scanners in keyboard mode can add stray whitespace or change case.
export function parseCardPayload(scanned: string): string | null {
  const value = scanned.trim();
  if (value.slice(0, PREFIX.length).toUpperCase() !== PREFIX) {
    return null;
  }
  const token = value.slice(PREFIX.length).toLowerCase();
  return TOKEN.test(token) ? token : null;
}

export function newCardToken() {
  return crypto.randomUUID().replace(/-/g, "");
}
