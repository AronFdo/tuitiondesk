"use client";

let context: AudioContext | null = null;

// A short tone, and on phones that can a matching buzz, so staff at the door
// know how a scan went without looking. Both fire together with the result
// on screen.
export function playScanSound(kind: "ok" | "repeat" | "problem") {
  try {
    navigator.vibrate?.(kind === "problem" ? [40, 60, 40] : kind === "ok" ? 25 : 0);
  } catch {
    // No vibration is fine.
  }
  try {
    context ??= new AudioContext();
    const tones = kind === "ok" ? [880] : kind === "repeat" ? [660] : [220, 220];
    tones.forEach((frequency, index) => {
      const oscillator = context!.createOscillator();
      const gain = context!.createGain();
      const start = context!.currentTime + index * 0.18;
      oscillator.frequency.value = frequency;
      oscillator.type = kind === "problem" ? "square" : "sine";
      gain.gain.setValueAtTime(0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
      oscillator.connect(gain).connect(context!.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.15);
    });
  } catch {
    // No sound is fine.
  }
}
