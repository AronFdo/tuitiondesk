import type { ReactNode } from "react";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { InviteParentButton } from "@/components/courses/invite-parent";
import { dueLine, GuardianReminder } from "@/components/students/guardian-reminder";
import { StudentActions } from "@/components/students/student-actions";
import { DocumentList } from "@/components/students/documents";
import { StudentPhoto } from "@/components/students/student-photo";
import { UploadDocumentButton } from "@/components/students/upload-document-button";
import { loadStudentAttendance } from "@/lib/attendance";
import { formatDate, formatMonth } from "@/lib/dates";
import { formatLkr } from "@/lib/money";
import { UPLOAD_DOCUMENT_KINDS } from "@/lib/document-kinds";
import { loadStudentDocuments } from "@/lib/student-documents";
import { formatReceiptNo } from "@/lib/receipt-format";
import { learningModeLabel, mediumLabel } from "@/lib/student-fields";
import { loadStudentFees, loadStudentProfile, type StudentProfile } from "@/lib/student-profile";
import { t } from "@/lib/t";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "attendance", label: "Attendance" },
  { key: "fees", label: "Fees" },
  { key: "documents", label: "Documents" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

type Params = Promise<{ studentId: string }>;
type SearchParams = Promise<{ tab?: string }>;

export default function StudentPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<p className="text-slate">{t("Loading…")}</p>}>
      <Profile params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Profile({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ studentId }, { tab }] = await Promise.all([params, searchParams]);
  const result = await loadStudentProfile(studentId);
  if (result.status === "signed-out") {
    redirect("/sign-in");
  }
  if (result.status === "not-found") {
    return (
      <div>
        <p className="text-slate">{t("That student is not in this class.")}</p>
        <Link href="/students" className="mt-4 inline-flex h-11 items-center text-forest">
          {t("All students")}
        </Link>
      </div>
    );
  }
  if (result.status === "error") {
    return (
      <p className="max-w-md text-slate">
        {result.missing
          ? t("Student cards are not set up yet. Run 018_student_identity.sql in Supabase, then refresh.")
          : t("This student could not be loaded. Refresh the page to try again.")}
      </p>
    );
  }

  const { profile } = result;
  const { student } = profile;
  // Fees and ID documents show only to staff allowed to see them.
  const tabs = TABS.filter(
    (item) =>
      (item.key !== "fees" || profile.canViewFees) &&
      (item.key !== "documents" || profile.canViewDocuments),
  );
  const active: TabKey = tabs.some((item) => item.key === tab) ? (tab as TabKey) : "overview";

  return (
    <div className="flex flex-col gap-6">
      <Link href="/students" className="text-sm text-forest">
        {t("Students")}
      </Link>

      <header className="flex flex-col items-center gap-5 md:flex-row md:items-start">
        <StudentPhoto
          studentId={student.id}
          name={student.fullName}
          photoUrl={student.photoUrl}
          canEdit={profile.canEdit}
        />
        <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center md:items-start md:text-left">
          <h1 className="max-w-full break-words">{student.fullName}</h1>
          <p className="tabular text-slate">{student.code}</p>
          {profile.courses.length > 0 ? (
            <p className="flex flex-wrap justify-center gap-x-3 gap-y-1 md:justify-start">
              {profile.courses.map((course) => (
                <Link key={course.id} href={`/courses/${course.id}`} className="text-sm text-forest">
                  {course.name}
                </Link>
              ))}
            </p>
          ) : (
            <p className="text-sm text-slate">{t("Not on a course")}</p>
          )}
          <div className="mt-2">
            <StudentActions
              canEdit={profile.canEdit}
              student={{
                id: student.id,
                fullName: student.fullName,
                dateOfBirth: student.dateOfBirth,
                gender: student.gender,
                guardianName: student.guardianName,
                guardianPhone: student.guardianPhone,
              }}
            />
          </div>
        </div>
        <figure className="flex flex-col items-center gap-1">
          <div
            className="size-32 rounded-lg border border-line bg-white p-1"
            role="img"
            aria-label={`${t("QR code for")} ${student.fullName}`}
            // Generated on the server from the student's token; no outside input.
            dangerouslySetInnerHTML={{ __html: student.cardSvg }}
          />
          <figcaption className="text-xs text-slate">
            {student.cardIssuedAt
              ? `${t("Card from")} ${formatDate(student.cardIssuedAt.slice(0, 10))}`
              : t("Student card")}
          </figcaption>
        </figure>
      </header>

      {tabs.length > 1 ? (
        <nav
          className="-mx-4 flex overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0"
          aria-label={t("Student sections")}
        >
          {tabs.map((item) => (
            <Link
              key={item.key}
              href={item.key === "overview" ? `/students/${student.id}` : `/students/${student.id}?tab=${item.key}`}
              scroll={false}
              aria-current={item.key === active ? "page" : undefined}
              className={`flex h-11 shrink-0 items-center border-b-2 px-4 text-sm font-medium ${
                item.key === active ? "border-forest text-forest" : "border-transparent text-slate"
              }`}
            >
              {t(item.label)}
            </Link>
          ))}
        </nav>
      ) : null}

      <Suspense key={active} fallback={<p className="text-slate">{t("Loading…")}</p>}>
        {active === "overview" ? <Overview profile={profile} /> : null}
        {active === "attendance" ? <Attendance studentId={student.id} /> : null}
        {active === "fees" ? <Fees profile={profile} /> : null}
        {active === "documents" ? <Documents studentId={student.id} /> : null}
      </Suspense>
    </div>
  );
}

function Overview({ profile }: { profile: StudentProfile }) {
  const { student } = profile;
  const d = student.details;
  const phone = (value: string | null) => (value?.startsWith("+94") ? `0${value.slice(3)}` : value);
  const sections: { title: string; items: [string, ReactNode][] }[] = [
    {
      title: t("Student"),
      items: [
        [t("Date of birth"), d.date_of_birth ? formatDate(d.date_of_birth) : null],
        [t("Gender"), d.gender === "female" ? t("Female") : d.gender === "male" ? t("Male") : null],
        [t("NIC"), d.nic],
        [t("Religion"), d.religion],
      ],
    },
    {
      title: t("Contact"),
      items: [
        [t("Phone"), phone(d.phone)],
        [t("Email"), d.email],
        [t("Address"), d.address],
        [
          t("Emergency contact"),
          [d.emergency_contact_name, phone(d.emergency_contact_phone)].filter(Boolean).join(" · ") || null,
        ],
      ],
    },
    {
      title: t("Learning"),
      items: [
        [t("Learning mode"), learningModeLabel(d.learning_mode) ? t(learningModeLabel(d.learning_mode) as string) : null],
        [t("Medium"), mediumLabel(d.medium) ? t(mediumLabel(d.medium) as string) : null],
        [t("School"), d.school],
        [t("Highest qualification"), d.qualification],
        [t("Occupation"), d.occupation],
        [t("O/L results"), d.ol_results],
        [t("A/L results"), d.al_results],
        ...profile.courses.map(
          (course): [string, ReactNode] => [
            course.name,
            course.startDate ? `${t("Since")} ${formatDate(course.startDate)}` : t("Enrolled"),
          ],
        ),
      ],
    },
    {
      title: t("Family"),
      items: [
        [t("Guardian"), [d.guardian_name, d.guardian_occupation].filter(Boolean).join(" · ") || null],
        [t("Guardian's phone"), phone(d.guardian_phone)],
        [t("Father"), [d.father_name, d.father_occupation].filter(Boolean).join(" · ") || null],
        [t("Mother"), [d.mother_name, d.mother_occupation].filter(Boolean).join(" · ") || null],
      ],
    },
    {
      title: t("Support"),
      items: [
        [t("Special needs"), d.has_special_needs ? d.special_needs || t("Yes") : null],
        [t("Notes"), d.notes],
      ],
    },
  ];

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      {profile.lastPaid ? (
        <p className="text-ink">
          <span className="text-slate">{`${t("Next due")}: `}</span>
          {dueLine(profile.nextDue)}
        </p>
      ) : null}
      {sections.map((section) => {
        const filled = section.items.filter(([, value]) => value !== null && value !== "");
        return (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {filled.length === 0 ? (
              <p className="mt-2 text-slate">
                {profile.canEdit ? (
                  <Link href={`/students/${student.id}/edit`} className="text-forest">
                    {t("Add details")}
                  </Link>
                ) : (
                  t("Nothing added yet.")
                )}
              </p>
            ) : (
              <dl className="mt-3 grid gap-4 sm:grid-cols-2">
                {filled.map(([label, value]) => (
                  <Detail key={label} label={label}>
                    <span className="whitespace-pre-line break-words">{value}</span>
                  </Detail>
                ))}
              </dl>
            )}
          </section>
        );
      })}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <GuardianReminder
          fullName={student.fullName}
          guardianName={student.guardianName}
          guardianPhone={student.guardianPhone}
          nextDue={profile.nextDue}
        />
        {profile.canInviteParent ? <InviteParentButton studentId={student.id} /> : null}
      </div>
    </div>
  );
}

async function Attendance({ studentId }: { studentId: string }) {
  const result = await loadStudentAttendance(studentId);
  if (result.status !== "ready") {
    return (
      <p className="max-w-md text-slate">
        {result.missing
          ? t("Attendance is not set up yet. Run 019_attendance.sql in Supabase, then refresh.")
          : t("Attendance could not be loaded. Refresh the page to try again.")}
      </p>
    );
  }
  if (result.courses.length === 0) {
    return <p className="text-slate">{t("Not on a course, so no attendance yet.")}</p>;
  }
  return (
    <div className="flex max-w-xl flex-col gap-8">
      {result.courses.map((course) => (
        <section key={course.courseId}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="min-w-0 break-words">{course.courseName}</h2>
            <p className="tabular shrink-0 text-slate">
              {course.rate === null ? t("No classes yet") : `${course.rate}% · ${course.present} / ${course.held}`}
            </p>
          </div>
          {course.sessions.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label={`${course.courseName} ${t("classes")}`}>
              {course.sessions.slice(0, 40).map((session) => (
                <li
                  key={session.id}
                  className={`rounded-md px-2 py-1 text-sm ${
                    session.present
                      ? "bg-mint-soft text-forest"
                      : "bg-[var(--status-overdue-bg)] text-[var(--status-overdue-fg)]"
                  }`}
                >
                  <span className="tabular">{formatDate(session.heldOn)}</span>
                  <span className="sr-only">{session.present ? t(" here") : t(" absent")}</span>
                  <span aria-hidden="true">{session.present ? " ✓" : " ✗"}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}

async function Fees({ profile }: { profile: StudentProfile }) {
  const result = await loadStudentFees(profile.student.id);
  if (result.status !== "ready") {
    return <p className="text-slate">{t("Payments could not be loaded. Refresh the page to try again.")}</p>;
  }
  const { tuition } = result.fees;
  return (
    <div className="flex max-w-xl flex-col gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate">{t("Next due")}</p>
          <p className="text-ink">{dueLine(profile.nextDue)}</p>
        </div>
        <Link
          href={`/payments?student=${profile.student.id}`}
          className="press inline-flex h-11 items-center justify-center rounded-lg bg-forest px-4 text-sm font-medium text-white"
        >
          {t("Record a payment")}
        </Link>
      </div>

      <section>
        <h2>{t("Tuition")}</h2>
        {tuition.length === 0 ? (
          <p className="mt-2 text-slate">{t("No tuition payment yet")}</p>
        ) : (
          <ul className="mt-2">
            {tuition.map((payment) => (
              <li key={payment.id} className="flex min-h-14 items-center justify-between gap-3 border-b border-line py-2">
                <span className="min-w-0">
                  <span className="block break-words text-ink">{`${payment.courseName} · ${formatMonth(payment.periodMonth)}`}</span>
                  <span className="text-sm text-slate">
                    {`${t("Paid")} ${formatDate(payment.paidOn)}`}
                    {payment.receipt ? (
                      <span className="tabular">{` · ${t("No.")} ${formatReceiptNo(payment.receipt.receiptNo)}`}</span>
                    ) : null}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="tabular text-ink">{formatLkr(payment.amountMinor)}</span>
                  {payment.receipt ? (
                    <a
                      href={`/receipts/${payment.receipt.id}`}
                      target="_blank"
                      rel="noopener"
                      aria-label={`${t("Receipt")}, ${formatMonth(payment.periodMonth)}`}
                      className="flex h-11 items-center px-2 text-sm font-medium text-forest"
                    >
                      {t("Receipt")}
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  );
}

async function Documents({ studentId }: { studentId: string }) {
  const result = await loadStudentDocuments(studentId);
  if (result.status !== "ready") {
    return <p className="text-slate">{t("Documents could not be loaded. Refresh the page to try again.")}</p>;
  }
  return (
    <section className="max-w-xl">
      <div className="flex items-center justify-between gap-4">
        <h2>{t("Documents")}</h2>
        <UploadDocumentButton studentId={studentId} kinds={UPLOAD_DOCUMENT_KINDS} />
      </div>
      <DocumentList
        documents={result.documents}
        empty={t("No documents yet. Upload a copy of the NIC, passport or birth certificate.")}
      />
    </section>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-slate">{label}</dt>
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  );
}
