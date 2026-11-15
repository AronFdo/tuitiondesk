import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { initials } from "@/components/students/student-avatar";
import { PrintButton } from "@/components/students/print-button";
import { loadCards, type PrintCard } from "@/lib/student-cards";
import { t } from "@/lib/t";

type SearchParams = Promise<{ student?: string; course?: string; layout?: string }>;

// CR80 cards (85.6 × 54 mm, the size of a bank card). "sheet" puts ten on an
// A4 page to cut out; "card" is one per page for a card printer.
const SHEET_CSS = `
@page { size: A4; margin: 8mm; }
.card-grid { display: grid; grid-template-columns: repeat(2, 85.6mm); column-gap: 6mm; row-gap: 2mm; justify-content: center; }
`;
const CARD_CSS = `
@page { size: 85.6mm 54mm; margin: 0; }
.card-grid { display: flex; flex-direction: column; align-items: center; gap: 4mm; }
@media print { .card-grid { gap: 0; } .student-card { break-after: page; border: 0 !important; border-radius: 0 !important; } }
`;

// On a phone the preview stacks one card per row, scaled to fit, instead of
// scrolling sideways. Printing is unaffected.
const SCREEN_CSS = `
@media screen and (max-width: 720px) { .card-grid { display: grid; grid-template-columns: 85.6mm; justify-content: center; } }
@media screen and (max-width: 380px) { .student-card { zoom: 0.85; } }
`;

export default function CardsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="p-4 text-slate">{t("Loading…")}</p>}>
      <Cards searchParams={searchParams} />
    </Suspense>
  );
}

async function Cards({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const layout = params.layout === "card" ? "card" : "sheet";
  const result = await loadCards({ student: params.student, course: params.course });
  if (result.status === "signed-out") {
    redirect("/sign-in");
  }
  if (result.status === "error") {
    return (
      <main className="mx-auto max-w-xl p-6">
        <p className="text-slate">{t("Those cards could not be loaded. Refresh the page to try again.")}</p>
        <Link href="/students" className="mt-4 inline-flex h-11 items-center text-forest">
          {t("All students")}
        </Link>
      </main>
    );
  }

  const base = new URLSearchParams();
  if (params.student) base.set("student", params.student);
  if (params.course) base.set("course", params.course);
  const href = (next: "sheet" | "card") => {
    const query = new URLSearchParams(base);
    if (next === "card") query.set("layout", "card");
    const text = query.toString();
    return text ? `/cards?${text}` : "/cards";
  };

  return (
    <main className="mx-auto max-w-[210mm] p-4 print:max-w-none print:p-0">
      <style>{(layout === "card" ? CARD_CSS : SHEET_CSS) + SCREEN_CSS}</style>
      <div className="mb-6 flex flex-col gap-4 print:hidden">
        <Link href={params.student ? `/students/${params.student}` : "/students"} className="text-sm text-forest">
          {t("Back")}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1>{`${t("Cards")} · ${t(result.title)}`}</h1>
            <p className="text-sm text-slate">
              {result.cards.length === 1 ? t("1 card") : `${result.cards.length} ${t("cards")}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-line p-1 text-sm" role="group" aria-label={t("Paper")}>
              <Link
                href={href("sheet")}
                aria-current={layout === "sheet" ? "page" : undefined}
                className={`rounded-md px-3 py-2 ${layout === "sheet" ? "bg-mint-soft text-forest" : "text-slate"}`}
              >
                {t("A4 sheet")}
              </Link>
              <Link
                href={href("card")}
                aria-current={layout === "card" ? "page" : undefined}
                className={`rounded-md px-3 py-2 ${layout === "card" ? "bg-mint-soft text-forest" : "text-slate"}`}
              >
                {t("Card printer")}
              </Link>
            </div>
            <PrintButton />
          </div>
        </div>
        {result.cards.some((card) => !card.photoUrl) ? (
          <p className="text-sm text-slate">
            {t("Some students have no photo yet. Their initials are printed instead.")}
          </p>
        ) : null}
      </div>

      {result.cards.length === 0 ? (
        <p className="text-slate print:hidden">{t("No students to print.")}</p>
      ) : (
        <div className="card-grid">
          {result.cards.map((card) => (
            <StudentCard
              key={card.id}
              card={card}
              instituteName={result.instituteName}
              logoUrl={result.logoUrl}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function StudentCard({
  card,
  instituteName,
  logoUrl,
}: {
  card: PrintCard;
  instituteName: string;
  logoUrl: string | null;
}) {
  return (
    <article
      className="student-card flex h-[54mm] w-[85.6mm] break-inside-avoid flex-col overflow-hidden rounded-[3mm] border border-line bg-white text-ink [print-color-adjust:exact] [-webkit-print-color-adjust:exact]"
    >
      <div className="flex h-[10mm] shrink-0 items-center gap-[2mm] bg-forest px-[3mm] text-white">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-[6.5mm] w-[6.5mm] rounded-[1mm] bg-white object-contain" />
        ) : null}
        <span className="truncate text-[8.5pt] font-semibold leading-none">{instituteName}</span>
      </div>
      <div className="flex min-h-0 flex-1 items-center gap-[2.5mm] px-[3mm] py-[2.5mm]">
        {card.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.photoUrl}
            alt=""
            className="h-[24mm] w-[20mm] shrink-0 rounded-[1.5mm] object-cover"
          />
        ) : (
          <span className="flex h-[24mm] w-[20mm] shrink-0 items-center justify-center rounded-[1.5mm] bg-mint-soft text-[14pt] font-semibold text-forest">
            {initials(card.fullName)}
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-[1mm] self-stretch justify-center">
          <p className="line-clamp-3 text-[9.5pt] font-semibold leading-tight break-words">{card.fullName}</p>
          <p className="tabular text-[9pt] leading-none text-forest">{card.code}</p>
        </div>
        <div
          className="h-[28mm] w-[28mm] shrink-0"
          // Generated on the server from the student's token; no outside input.
          dangerouslySetInnerHTML={{ __html: card.qrSvg }}
        />
      </div>
    </article>
  );
}
