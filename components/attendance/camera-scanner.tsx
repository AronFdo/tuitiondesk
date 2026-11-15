"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/t";

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorClass = {
  new (options: { formats: string[] }): Detector;
  getSupportedFormats: () => Promise<string[]>;
};

// Reads QR codes from the camera: the browser's own detector where there is
// one (Chrome on Android and Mac), otherwise jsQR on video frames (Safari,
// Firefox, Chrome on Windows).
export function CameraScanner({ onScan }: { onScan: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const latest = useRef(onScan);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    latest.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function start() {
      const element = video.current;
      if (!element) {
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setProblem(t("This browser cannot use the camera. Use Chrome or Safari over https."));
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        setProblem(t("The camera could not be opened. Allow camera access for this site and try again."));
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      element.srcObject = stream;
      await element.play().catch(() => undefined);

      const detect = await makeDetector();
      const tick = async () => {
        if (stopped) {
          return;
        }
        if (element.readyState >= 2) {
          const text = await detect(element).catch(() => null);
          if (text && !stopped) {
            latest.current(text);
          }
        }
        timer = setTimeout(() => void tick(), 200);
      };
      void tick();
    }

    void start();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-ink">
        <video ref={video} className="size-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-white/80" />
      </div>
      {problem ? <p role="alert" className="text-sm text-destructive">{problem}</p> : (
        <p className="text-sm text-slate">{t("Hold the card's QR code inside the square.")}</p>
      )}
    </div>
  );
}

async function makeDetector(): Promise<(video: HTMLVideoElement) => Promise<string | null>> {
  const Native = (globalThis as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
  if (Native) {
    try {
      if ((await Native.getSupportedFormats()).includes("qr_code")) {
        const detector = new Native({ formats: ["qr_code"] });
        return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
      }
    } catch {
      // Fall through to jsQR.
    }
  }
  const jsQR = (await import("jsqr")).default;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  return async (video) => {
    if (!context || !video.videoWidth) {
      return null;
    }
    const scale = Math.min(1, 640 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data ?? null;
  };
}
