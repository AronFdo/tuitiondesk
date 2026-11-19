import { describe, expect, it } from "vitest";
import { ScanDetector } from "../lib/scanner";

const code = "TD1:0123456789abcdef0123456789abcdef";

// Types text into the detector, `gap` ms apart, starting at `start`.
function type(detector: ScanDetector, text: string, gap: number, start = 1000) {
  const results = [];
  let time = start;
  for (const key of text) {
    // Scanners send Shift before capitals and the colon.
    if (/[A-Z:]/.test(key)) {
      results.push(detector.key("Shift", time));
    }
    results.push(detector.key(key, time));
    time += gap;
  }
  return { results, time };
}

describe("ScanDetector", () => {
  it("finishes a card scan on the last character, and swallows the Enter after it", () => {
    const detector = new ScanDetector();
    const { results, time } = type(detector, code, 8);
    expect(results.at(-1)).toEqual({ scan: code, swallow: true });
    expect(detector.key("Enter", time + 5)).toEqual({ scan: null, swallow: true });
  });

  it("finishes a link card on its last character and swallows every key of it", () => {
    const link = "https://app.tuitiondesk.lk/c/0123456789abcdef0123456789abcdef";
    const detector = new ScanDetector();
    const results = [...link].map((key, index) => detector.key(key, 1000 + index * 8));
    const time = 1000 + link.length * 8;
    expect(results.at(-1)).toEqual({ scan: link, swallow: true });
    // After the first character, every character belongs to the scan, so
    // none of it lands in a focused search box.
    expect(results.slice(1).every((result) => result.swallow)).toBe(true);
    expect(detector.key("Enter", time + 5)).toEqual({ scan: null, swallow: true });
  });

  it("reports other fast bursts that end in Enter", () => {
    const detector = new ScanDetector();
    const { time } = type(detector, "4791234567890", 10);
    expect(detector.key("Enter", time)).toEqual({ scan: "4791234567890", swallow: true });
  });

  it("ignores people typing", () => {
    const detector = new ScanDetector();
    const { results, time } = type(detector, "nimal perera", 120);
    expect(results.every((result) => result.scan === null && !result.swallow)).toBe(true);
    expect(detector.key("Enter", time + 100)).toEqual({ scan: null, swallow: false });
  });

  it("does not let a person's Enter be eaten", () => {
    const detector = new ScanDetector();
    expect(detector.key("Enter", 5000)).toEqual({ scan: null, swallow: false });
  });

  it("swallows the characters of a card scan so they stay out of a search box", () => {
    const detector = new ScanDetector();
    const swallowed: boolean[] = [];
    let time = 1000;
    for (const key of code) {
      swallowed.push(detector.key(key, time).swallow);
      time += 8;
    }
    // The first T cannot be told apart from typing yet; every later key can.
    expect(swallowed[0]).toBe(false);
    expect(swallowed.slice(1).every(Boolean)).toBe(true);
  });

  it("starts again after a pause, so a stray key before a scan does not spoil it", () => {
    const detector = new ScanDetector();
    detector.key("x", 0);
    const { results } = type(detector, code, 8, 2000);
    expect(results.at(-1)?.scan).toBe(code);
  });

  it("handles a slow Bluetooth scanner within the gap", () => {
    const detector = new ScanDetector({ maxGapMs: 60 });
    const { results } = type(detector, code, 45);
    expect(results.at(-1)?.scan).toBe(code);
  });
});
