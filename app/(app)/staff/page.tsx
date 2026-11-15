import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { loadStaffList, loginLabel } from "@/lib/staff";
import { t } from "@/lib/t";

type SearchParams = Promise<{ show?: string }>;

export default function StaffPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="text-slate">{t("Loading…")}</p>}>
      <StaffList searchParams={searchParams} />
    </Suspense>
  );
}

async function StaffList({ searchParams }: { searchParams: SearchParams }) {
  const archived = (await searchParams).show === "former";
  const page = await loadStaffList({ archived });
  if (page.status === "signed-out") {
    redirect("/sign-in");
  }
  if (page.status === "forbidden") {
    return (
      <div>
        <h1>{t("Staff")}</h1>
        <p className="mt-2 text-slate">{t("Only the class owner can see the staff list.")}</p>
      </div>
    );
  }
  if (page.status === "error") {
    return (
      <div>
        <h1>{t("Staff")}</h1>
        <p className="mt-2 max-w-md text-slate">
          {page.missing
            ? t("The staff directory is not set up yet. Run 028_staff.sql in Supabase, then refresh.")
            : t("Staff could not be loaded. Refresh the page to try again.")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>{archived ? t("Former staff") : t("Staff")}</h1>
          <p className="text-sm text-slate">
            {page.staff.length === 1 ? t("1 person") : `${page.staff.length} ${t("people")}`}
            {" · "}
            <Link href={archived ? "/staff" : "/staff?show=former"} className="text-forest">
              {archived ? t("Back to current staff") : t("Former staff")}
            </Link>
          </p>
        </div>
        {archived ? null : (
          <Link
            href="/staff/new"
            className="press inline-flex h-11 items-center justify-center rounded-lg bg-forest px-4 text-sm font-medium text-white"
          >
            {t("Add staff member")}
          </Link>
        )}
      </div>

      {page.staff.length === 0 ? (
        <p className="mt-6 text-slate">{archived ? t("No former staff.") : t("No staff yet.")}</p>
      ) : (
        <ul className="mt-4">
          {page.staff.map((member) => (
            <li key={member.id} className="border-b border-line">
              <Link href={`/staff/${member.id}`} className="row pressable gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-ink">{member.fullName}</span>
                  <span className="block text-sm text-slate">
                    {[
                      member.title,
                      archived ? null : loginLabel(member.login),
                      member.courseCount > 0
                        ? member.courseCount === 1
                          ? t("1 course")
                          : `${member.courseCount} ${t("courses")}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-slate" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
