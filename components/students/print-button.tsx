"use client";

import { t } from "@/lib/t";

export function PrintButton() {
  return (
    <button
      type="button"
      className="press inline-flex h-11 items-center justify-center rounded-lg bg-forest px-5 text-sm font-medium text-white"
      onClick={() => window.print()}
    >
      {t("Print")}
    </button>
  );
}
