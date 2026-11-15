import type { ReactNode } from "react";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ReceiptPrintControls } from "@/components/receipts/receipt-print-controls";
import { formatDate, formatMonth, formatTime } from "@/lib/dates";
import { formatReceiptNo, PRINTABLE_MM, receiptAmount } from "@/lib/receipt-format";
import { loadReceipt, type ReceiptView } from "@/lib/receipts";
import { t } from "@/lib/t";

type Params = Promise<{ receiptId: string }>;
type SearchParams = Promise<{ print?: string }>;

// A receipt sized for a thermal roll. The browser prints it through the
// printer's own driver; Chrome started with --kiosk-printing skips the dialog.
export default function ReceiptPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="p-4 text-slate">{t("Loading…")}</p>}>
      <Receipt params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Receipt({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ receiptId }, { print }] = await Promise.all([params, searchParams]);
  const result = await loadReceipt(receiptId);
  if (result.status === "signed-out") {
    redirect("/sign-in");
  }
  if (result.status !== "ready") {
    return (
      <main className="mx-auto max-w-md p-6">
        <p className="text-slate">
          {result.status === "forbidden"
            ? t("Only the class owner can print receipts.")
            : result.status === "error" && result.missing
              ? t("Receipts are not set up yet. Run 021_receipts.sql in Supabase, then refresh.")
              : result.status === "not-found"
                ? t("That receipt is not in this class.")
                : t("That receipt could not be loaded. Refresh the page to try again.")}
        </p>
        <Link href="/payments" className="mt-4 inline-flex h-11 items-center text-forest">
          {t("Payments")}
        </Link>
      </main>
    );
  }

  const { receipt } = result;
  const paper = receipt.institute.paper;
  const width = PRINTABLE_MM[paper];
  const css = `
@page { size: ${paper}mm auto; margin: 0; }
@media print { html, body { background: #fff !important; } }
.receipt { width: ${width}mm; font-size: ${paper === 58 ? 8.5 : 9.5}pt; line-height: 1.35; }
`;

  return (
    <main className="min-h-screen bg-paper py-6 print:min-h-0 print:bg-white print:py-0">
      <style>{css}</style>
      <div className="mx-auto mb-6 flex max-w-md flex-wrap items-center justify-between gap-3 px-4 print:hidden">
        <Link href={`/students/${receipt.student.id}?tab=fees`} className="text-sm text-forest">
          {receipt.student.fullName}
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/payments"
            className="press inline-flex h-11 items-center justify-center rounded-lg border border-line bg-surface px-4 text-sm font-medium text-forest"
          >
            {t("Payments")}
          </Link>
          <ReceiptPrintControls receiptId={receipt.id} autoPrint={print === "1"} />
        </div>
      </div>
      <p className="mx-auto mb-4 max-w-md px-4 text-sm text-slate print:hidden">
        {`${t("Paper")}: ${paper} mm. ${t("Change it in Settings › Receipts.")}`}
      </p>
      <ReceiptSlip receipt={receipt} />
    </main>
  );
}

function ReceiptSlip({ receipt }: { receipt: ReceiptView }) {
  const { institute } = receipt;
  return (
    <article className="receipt mx-auto bg-white px-[2mm] py-[4mm] text-black shadow-sm print:shadow-none [font-variant-numeric:tabular-nums]">
      <header className="flex flex-col items-center gap-[1mm] text-center">
        {institute.logoUrl ? (
          // Thermal heads print one colour; grayscale keeps the logo from dithering into noise.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={institute.logoUrl} alt="" className="max-h-[14mm] max-w-[30mm] object-contain grayscale" />
        ) : null}
        <p className="text-[1.25em] font-bold leading-tight">{institute.name}</p>
        {institute.address ? <p className="whitespace-pre-line">{institute.address}</p> : null}
        {institute.phone ? <p>{institute.phone}</p> : null}
      </header>

      <Rule />
      {receipt.voided ? <Stamp>{t("VOID")}</Stamp> : receipt.copy ? <Stamp>{t("COPY")}</Stamp> : null}

      <Row left={<strong className="text-[1.1em]">{t("RECEIPT")}</strong>} right={<strong>{`${t("No.")} ${formatReceiptNo(receipt.receiptNo)}`}</strong>} />
      <p>{`${formatDate(receipt.issuedAt.slice(0, 10))}, ${formatTime(receipt.issuedAt)}`}</p>
      <p className="mt-[1mm] break-words">
        {receipt.student.fullName}
        <span className="whitespace-nowrap">{` (${receipt.student.code})`}</span>
      </p>

      <Rule />
      <p className="break-words font-semibold">{receipt.line.courseName}</p>
      <Row left={`${t("Tuition for")} ${formatMonth(receipt.line.periodMonth)}`} right={receiptAmount(receipt.line.amountMinor)} />

      <Rule />
      <Row
        left={<strong className="text-[1.15em]">{t("TOTAL")}</strong>}
        right={<strong className="text-[1.15em]">{`LKR ${receiptAmount(receipt.totalMinor)}`}</strong>}
      />
      <p>{`${t("Paid on")} ${formatDate(receipt.line.paidOn)}`}</p>
      {receipt.receivedBy ? <p>{`${t("Received by")} ${receipt.receivedBy}`}</p> : null}

      <Rule />
      <p className="text-center">{institute.footer ?? t("Thank you.")}</p>
      {receipt.voided ? <Stamp>{t("VOID")}</Stamp> : null}
    </article>
  );
}

function Row({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-[2mm]">
      <span className="min-w-0 break-words">{left}</span>
      <span className="shrink-0 text-end">{right}</span>
    </div>
  );
}

function Rule() {
  return <hr className="my-[2mm] border-0 border-t border-dashed border-black" />;
}

function Stamp({ children }: { children: ReactNode }) {
  return (
    <p className="my-[1.5mm] border-2 border-black py-[0.5mm] text-center text-[1.3em] font-bold tracking-[0.2em]">
      {children}
    </p>
  );
}
