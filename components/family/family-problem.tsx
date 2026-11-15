import Link from "next/link";
import { redirect } from "next/navigation";
import { t } from "@/lib/t";

type Problem =
  | { status: "signed-out" }
  | { status: "staff" }
  | { status: "error"; missing: boolean }
  | { status: "not-found" };

// Sends people who are not parents where they belong, and explains the rest.
export function FamilyProblem({ problem }: { problem: Problem }) {
  if (problem.status === "signed-out") {
    redirect("/sign-in");
  }
  if (problem.status === "staff") {
    redirect("/dashboard");
  }
  if (problem.status === "not-found") {
    return (
      <div>
        <p className="text-slate">{t("That child is not linked to this login.")}</p>
        <Link href="/family" className="mt-4 inline-flex h-11 items-center text-forest">
          {t("Back to home")}
        </Link>
      </div>
    );
  }
  return (
    <p className="text-slate">
      {problem.missing
        ? t("The portal is not set up yet. Ask the class to finish setup, then refresh.")
        : t("This page could not be loaded. Refresh to try again.")}
    </p>
  );
}
