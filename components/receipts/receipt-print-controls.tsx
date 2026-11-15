"use client";

import { useEffect, useRef } from "react";
import { markReceiptPrinted } from "@/lib/actions/receipts";
import { t } from "@/lib/t";

// Opens the print dialog once the receipt (and its logo) has loaded, and
// counts each print so the next one says COPY. Browsers report a cancelled
// print dialog the same way as a finished print, so a cancel counts too.
export function ReceiptPrintControls({
  receiptId,
  autoPrint,
}: {
  receiptId: string;
  autoPrint: boolean;
}) {
  const started = useRef(false);

  useEffect(() => {
    const counted = () => void markReceiptPrinted({ receiptId }).catch(() => undefined);
    window.addEventListener("afterprint", counted);

    if (autoPrint && !started.current) {
      started.current = true;
      const images = Array.from(document.images).filter((image) => !image.complete);
      void Promise.all([
        document.fonts.ready,
        ...images.map((image) => new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        })),
      ]).then(() => window.print());
    }
    return () => window.removeEventListener("afterprint", counted);
  }, [receiptId, autoPrint]);

  return (
    <button
      type="button"
      className="press inline-flex h-11 items-center justify-center rounded-lg bg-forest px-5 text-sm font-medium text-white"
      onClick={() => window.print()}
    >
      {t("Print receipt")}
    </button>
  );
}
