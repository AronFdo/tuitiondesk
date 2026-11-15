import type { ReactNode } from "react";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { StaffActions } from "@/components/staff/staff-actions";
import { formatDate } from "@/lib/dates";
import { loadStaffMember, loginLabel } from "@/lib/staff";
import { loginResultText } from "@/lib/staff-login";
import { t } from "@/lib/t";

type Params = Promise<{ staffId: string }>;
type SearchParams = Promise<{ login?: string }>;

export default function StaffMemberPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="text-slate">{t("Loading…")}</p>}>
      <StaffMember params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function StaffMember({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ staffId }, { login: loginResult }] = await Promise.all([params, searchParams]);
  const result = await loadStaffMember(staffId);
  if (result.status === "signed-out") {
    redirect("/sign-in");
  }
  if (result.status === "forbidden") {
    return <p className="text-slate">{t("Only the class owner can see the staff list.")}</p>;
  }
  if (result.status === "not-found") {
    return <p className="text-slate">{t("That person is not on your staff.")}</p>;
  }
  if (result.status === "error") {
    return (
      <p className="max-w-md text-slate">
        {result.missing
          ? t("The staff directory is not set up yet. Run 028_staff.sql in Supabase, then refresh.")
          : t("This staff member could not be loaded. Refresh the page to try again.")}
      </p>
    );
  }

  const { member } = result;
  const d = member.details;
  const active = member.status === "active";
  const phone = d.phone?.startsWith("+94") ? `0${d.phone.slice(3)}` : d.phone;
  const items: [string, ReactNode][] = [
    [t("Job title"), d.title],
    [t("Login"), active ? loginLabel(member.login) : null],
    [t("Phone"), phone],
    [t("Email"), d.email],
    [t("NIC"), d.nic],
    [t("Address"), d.address],
    [t("Subjects"), d.subjects],
    [t("Joined on"), d.joined_on ? formatDate(d.joined_on) : null],
    [t("Left on"), !active && member.leftOn ? formatDate(member.leftOn) : null],
    [t("Notes"), d.notes],
  ];
  const filled = items.filter(([, value]) => value !== null && value !== "");
  // Set by the add form when it also gave (or tried to give) a login.
  const notice = active ? loginResultText(loginResult) : null;

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div>
        <Link href={active ? "/staff" : "/staff?show=former"} className="text-sm text-forest">
          {active ? t("Staff") : t("Former staff")}
        </Link>
        <h1 className="mt-1 break-words">{d.full_name}</h1>
        {member.isSelf ? <p className="text-sm text-slate">{t("This is you.")}</p> : null}
        {notice ? (
          <p
            role="status"
            className={`mt-4 rounded-lg border p-3 text-sm ${
              notice.ok
                ? "border-line bg-mint-soft text-forest"
                : "border-line bg-[var(--status-overdue-bg)] text-[var(--status-overdue-fg)]"
            }`}
          >
            {notice.text}
          </p>
        ) : null}
        <div className="mt-4">
          <StaffActions
            member={{
              id: member.id,
              fullName: d.full_name,
              email: d.email,
              active,
              login: member.login,
              isSelf: member.isSelf,
            }}
          />
        </div>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        {filled.map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-slate">{label}</dt>
            <dd className="mt-0.5 whitespace-pre-line break-words text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      {active ? (
        <section>
          <h2>{t("Courses they teach")}</h2>
          {member.courses.length === 0 ? (
            <p className="mt-2 text-slate">
              {member.login
                ? t("None yet. Choose courses from Edit details.")
                : t("Give them login access first; a course's teacher signs in to take attendance.")}
            </p>
          ) : (
            <ul className="mt-2">
              {member.courses.map((course) => (
                <li key={course.id} className="border-b border-line py-3">
                  <Link href={`/courses/${course.id}`} className="text-forest">
                    {course.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
