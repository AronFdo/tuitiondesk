"use client";

import type { ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { useSheetDrag } from "@/components/ui/use-sheet-drag";
import { t } from "@/lib/t";

// Keyboard users reach this first; it appears when focused so they can see
// where focus is. Pointer users close with Cancel, the backdrop or a swipe.
const closeClassName =
  "sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-3 focus-visible:right-3 focus-visible:rounded-md focus-visible:bg-surface focus-visible:px-3 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

// A bottom sheet on phones, a centred dialog from md up. The sheet-motion and
// backdrop-motion classes in globals.css animate it in and out.
const popupClassName =
  "sheet-motion fixed z-50 flex max-h-[min(90dvh,720px)] w-full flex-col overflow-y-auto overscroll-contain bg-surface p-5 shadow-[0_16px_40px_rgba(18,38,28,0.16)] inset-x-0 bottom-0 rounded-t-2xl pb-[max(1.25rem,env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-[min(440px,calc(100vw-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl";

export function FormDialog({
  open,
  title,
  onOpenChange,
  children,
}: {
  open: boolean;
  title: string;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const { sheetRef, handleProps } = useSheetDrag(() => onOpenChange(false));
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="backdrop-motion fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Popup ref={sheetRef} className={popupClassName}>
          <SheetHandle {...handleProps} />
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Close className={closeClassName}>{t("Close")}</Dialog.Close>
          <div className="mt-4">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  pending,
  error,
  onOpenChange,
  onConfirm,
  confirmLabel,
  pendingLabel,
  tone = "danger",
}: {
  open: boolean;
  title: string;
  body: string;
  pending: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  confirmLabel?: string;
  pendingLabel?: string;
  tone?: "danger" | "primary";
}) {
  // While saving, the sheet stays put.
  const { sheetRef, handleProps } = useSheetDrag(() => onOpenChange(false), !pending);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={onOpenChange}
      disablePointerDismissal={pending}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="backdrop-motion fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Popup ref={sheetRef} className={popupClassName}>
          <SheetHandle {...handleProps} />
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Close className={closeClassName}>{t("Close")}</Dialog.Close>
          <Dialog.Description className="mt-2 text-slate">{body}</Dialog.Description>
          {error ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              disabled={pending}
              className="press inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-line bg-surface text-sm font-medium text-forest disabled:opacity-50"
              onClick={() => onOpenChange(false)}
            >
              {t("Cancel")}
            </button>
            <button
              type="button"
              data-slot="button"
              className={`press inline-flex h-11 flex-1 items-center justify-center rounded-lg text-sm font-medium text-white disabled:opacity-50 ${tone === "danger" ? "bg-destructive" : "bg-forest"}`}
              disabled={pending}
              onClick={onConfirm}
            >
              {pending ? (pendingLabel ?? t("Deleting…")) : (confirmLabel ?? t("Delete"))}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// The grab bar on a phone sheet: drag it down (or flick) to close. A tall
// invisible strip around the bar keeps it easy to catch with a thumb.
function SheetHandle(props: ReturnType<typeof useSheetDrag>["handleProps"]) {
  return (
    <div
      aria-hidden="true"
      className="-mx-5 -mt-5 mb-1 flex h-7 cursor-grab touch-none items-center justify-center active:cursor-grabbing md:hidden"
      {...props}
    >
      <span className="h-[5px] w-9 rounded-full bg-line" />
    </div>
  );
}

export function cancelClassName() {
  return "press inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-line bg-surface text-sm font-medium text-forest";
}
