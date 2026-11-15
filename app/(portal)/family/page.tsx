import { Suspense } from "react";
import { redirect } from "next/navigation";
import { FamilyProblem } from "@/components/family/family-problem";
import { signOut } from "@/lib/actions/auth";
import { loadFamilyFrame } from "@/lib/family";
import { t } from "@/lib/t";

export default function FamilyPage() {
  return (
    <Suspense fallback={<p className="p-4 text-slate">{t("Loading…")}</p>}>
      <FamilyStart />
    </Suspense>
  );
}

// Opens the first child's home; the switcher handles the rest.
async function FamilyStart() {
  const frame = await loadFamilyFrame();
  if (frame.status !== "ready") {
    return (
      <main className="mx-auto w-full max-w-[640px] px-4 py-6">
        <FamilyProblem problem={frame} />
      </main>
    );
  }
  if (frame.children.length > 0) {
    redirect(`/family/${frame.children[0].id}`);
  }
  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between gap-4">
        <p className="truncate text-sm font-medium text-forest">{frame.instituteName}</p>
        <form action={signOut}>
          <button type="submit" className="h-11 px-2 text-sm text-forest">
            {t("Sign out")}
          </button>
        </form>
      </header>
      <div>
        <h1>{t("Welcome")}</h1>
        <p className="mt-2 text-slate">
          {t("Your class has not linked a student to this login yet.")}
        </p>
      </div>
    </main>
  );
}
