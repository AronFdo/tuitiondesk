// What a student's card QR code carries. Nothing personal goes in the code,
// so a lost card gives away nothing and reissuing it (a new token) makes the
// old one useless.
//
// Cards hold a link, https://<site>/c/<token>, so a phone camera opens the
// student's profile for signed-in staff (app/c/[token]). Cards printed before
// that hold "TD1:<token>"; both still scan everywhere.

const LEGACY_PREFIX = "TD1:";
const TOKEN = /^[0-9a-f]{32}$/;
const LINK_PATH = /^\/c\/([0-9a-f]{32})\/?$/i;

// origin is the site's address, like https://app.tuitiondesk.lk.
export function cardPayload(qrToken: string, origin: string) {
  return `${origin.replace(/\/+$/, "")}${cardPath(qrToken)}`;
}

export function cardPath(qrToken: string) {
  return `/c/${qrToken}`;
}

// The token from a scanned code, or null for anything that is not one of our
// cards. Scanners in keyboard mode can add stray whitespace or change case.
// Any site address is accepted: the token alone identifies the card, so a
// card printed on a preview or old address still works.
export function parseCardPayload(scanned: string): string | null {
  const value = scanned.trim();
  if (value.slice(0, LEGACY_PREFIX.length).toUpperCase() === LEGACY_PREFIX) {
    const token = value.slice(LEGACY_PREFIX.length).toLowerCase();
    return TOKEN.test(token) ? token : null;
  }
  if (!/^https?:\/\//i.test(value)) {
    return null;
  }
  let path: string;
  try {
    const url = new URL(value);
    if (url.search || url.hash) {
      return null;
    }
    path = url.pathname;
  } catch {
    return null;
  }
  const match = LINK_PATH.exec(path);
  return match ? match[1].toLowerCase() : null;
}

export function isCardToken(value: string) {
  return TOKEN.test(value);
}

export function newCardToken() {
  return crypto.randomUUID().replace(/-/g, "");
}
