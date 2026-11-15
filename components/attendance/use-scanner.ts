"use client";

import { useEffect, useRef } from "react";
import { ScanDetector } from "@/lib/scanner";

// Listens to the whole page for a keyboard-mode QR reader. Works whatever has
// focus, and keeps the scanner's keys out of buttons and text boxes.
export function useScanner(onScan: (text: string) => void, enabled: boolean) {
  const latest = useRef(onScan);
  useEffect(() => {
    latest.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const detector = new ScanDetector();
    function handle(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
        return;
      }
      const result = detector.key(event.key, event.timeStamp || performance.now());
      if (result.swallow) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (result.scan) {
        latest.current(result.scan);
      }
    }
    window.addEventListener("keydown", handle, true);
    return () => window.removeEventListener("keydown", handle, true);
  }, [enabled]);
}
