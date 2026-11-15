import { Suspense } from "react";
import { FamilyProblem } from "@/components/family/family-problem";
import { PortalShell } from "@/components/family/portal-shell";
import { loadFamilyFrame } from "@/lib/family";
import { t } from "@/lib/t";

export default function ChildLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ childId: string }> }>) {
  return (
    <Suspense fallback={<p className="p-4 text-slate">{t("Loading…")}</p>}>
      <Frame params={params}>{children}</Frame>
    </Suspense>
  );
}

async function Frame({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ childId: string }> }>) {
  const [{ childId }, frame] = await Promise.all([params, loadFamilyFrame()]);
  if (frame.status !== "ready") {
    return (
      <main className="mx-auto w-full max-w-[640px] px-4 py-6">
        <FamilyProblem problem={frame} />
      </main>
    );
  }
  return (
    <PortalShell
      instituteName={frame.instituteName}
      logoUrl={frame.logoUrl}
      familyChildren={frame.children}
      childId={childId}
    >
      {children}
    </PortalShell>
  );
}
