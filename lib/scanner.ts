import { parseCardPayload } from "@/lib/student-card";

// USB and Bluetooth QR readers in keyboard mode "type" what they read, far
// faster than a person, usually followed by Enter. This tells the two apart
// from key timings alone, so the scan screen needs no focused text box.

export type ScanDetectorOptions = {
  // Longest gap between two keys of one scan. Wired scanners send a key every
  // 5-20 ms; Bluetooth ones can be slower. People type 80 ms apart or more.
  maxGapMs?: number;
  // Shortest burst worth reporting.
  minLength?: number;
};

export type KeyResult = {
  // The scanned text, when this key finished a scan.
  scan: string | null;
  // The key belongs to a scan, so the page should not act on it: an Enter
  // would press whatever button has focus, and the characters would land in
  // a focused search box.
  swallow: boolean;
};

// How a card's code starts: a link (current cards) or "TD1:" (older ones).
const CARD_STARTS = ["HTTPS://", "HTTP://", "TD1:"];

export class ScanDetector {
  private buffer = "";
  private last = -Infinity;
  private suffixUntil = -Infinity;
  private readonly maxGapMs: number;
  private readonly minLength: number;

  constructor(options: ScanDetectorOptions = {}) {
    this.maxGapMs = options.maxGapMs ?? 60;
    this.minLength = options.minLength ?? 8;
  }

  // Feed every KeyboardEvent.key with its time in milliseconds.
  key(key: string, time: number): KeyResult {
    const gap = time - this.last;

    if (key === "Enter" || key === "Tab") {
      // The suffix of a code that already finished on its own.
      if (time <= this.suffixUntil) {
        this.suffixUntil = -Infinity;
        return { scan: null, swallow: true };
      }
      const text = this.buffer;
      this.reset();
      // Some scanners pause a moment before the suffix.
      const scanned = text.length >= this.minLength && gap <= this.maxGapMs * 4;
      return { scan: scanned ? text : null, swallow: scanned };
    }
    // Shift, Control and the like come with every capital letter or colon.
    if (key.length !== 1) {
      return { scan: null, swallow: false };
    }

    const continuing = gap <= this.maxGapMs && this.buffer.length > 0;
    this.buffer = continuing ? this.buffer + key : key;
    this.last = time;

    // A complete card code ends the scan even if the scanner sends no Enter.
    if (parseCardPayload(this.buffer)) {
      const text = this.buffer;
      this.reset();
      this.suffixUntil = time + this.maxGapMs * 4;
      return { scan: text, swallow: true };
    }
    return { scan: null, swallow: continuing && looksLikeCard(this.buffer) };
  }

  reset() {
    this.buffer = "";
    this.last = -Infinity;
  }
}

function looksLikeCard(text: string) {
  const upper = text.toUpperCase();
  return CARD_STARTS.some((start) => upper.startsWith(start) || start.startsWith(upper));
}
