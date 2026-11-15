import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  InstituteForm,
  LogoForm,
  DueDaysForm,
} from "@/components/settings/institute-forms";
import {
  SettingsNav,
  settingsSection,
  settingsSections,
  type SettingsSection,
} from "@/components/settings/settings-nav";
import { ReceiptSettingsForm } from "@/components/settings/receipt-settings";
import { loadDueDays } from "@/lib/due-days";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/supabase/session";
import { t } from "@/lib/t";
import { can } from "@/lib/permissions";

export default function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-slate">{t("Loading…")}</p>}>
      <Settings searchParams={searchParams} />
    </Suspense>
  );
}

async function Settings({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const staff = await getStaff();
  if (!staff) {
    redirect("/sign-in");
  }

  const section = settingsSection((await searchParams).section);
  const admin = can(staff, "institute.manage");
  const sections = admin ? settingsSections : settingsSections.slice(0, 1);

  return (
    <div>
      <h1>{t("Settings")}</h1>
      <div className="mt-6 flex flex-col gap-8 md:flex-row md:items-start">
        <SettingsNav active={admin ? section : "class"} sections={sections} />
        <div className="min-w-0 flex-1">
          {admin ? (
            <AdminPanel section={section} institute={staff.institute} />
          ) : (
            <ClassSummary institute={staff.institute} />
          )}
        </div>
      </div>
    </div>
  );
}

function AdminPanel({
  section,
  institute,
}: {
  section: SettingsSection;
  institute: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    timezone: string;
  };
}) {
  if (section === "days") {
    return <DueDays instituteId={institute.id} />;
  }
  if (section === "receipts") {
    return <ReceiptSettings instituteId={institute.id} />;
  }
  if (section === "logo") {
    return <LogoForm />;
  }
  if (section === "teachers") {
    return (
      <div className="max-w-md">
        <h2>{t("Staff and logins")}</h2>
        <p className="mt-2 text-slate">
          {t("Add teachers and other staff, give them a login, and choose the courses they teach from the Staff page.")}
        </p>
        <Link
          href="/staff"
          className="press mt-4 inline-flex h-11 items-center justify-center rounded-lg bg-forest px-4 text-sm font-medium text-white"
        >
          {t("Open Staff")}
        </Link>
      </div>
    );
  }
  return <InstituteForm institute={institute} />;
}

async function ReceiptSettings({ instituteId }: { instituteId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("institutes")
    .select("receipt_paper_mm, receipt_footer")
    .eq("id", instituteId)
    .maybeSingle();
  if (error || !data) {
    return (
      <p className="max-w-md text-slate">
        {error?.code === "42703"
          ? t("Receipts are not set up yet. Run 021_receipts.sql in Supabase, then refresh.")
          : t("Receipt settings could not be loaded. Refresh the page to try again.")}
      </p>
    );
  }
  return (
    <ReceiptSettingsForm
      defaults={{ paperMm: data.receipt_paper_mm === 58 ? "58" : "80", footer: data.receipt_footer ?? "" }}
    />
  );
}

async function DueDays({ instituteId }: { instituteId: string }) {
  const dueDays = await loadDueDays(instituteId);
  if (dueDays.status !== "ready") {
    return (
      <div className="max-w-md">
        <h2 className="text-lg">{t("Fee due dates")}</h2>
        <p className="mt-2 text-slate">
          {dueDays.status === "missing"
            ? t(
                "Due dates are not set up yet. Run the due dates SQL in Supabase, then refresh.",
              )
            : t("Due dates could not be loaded.")}
        </p>
      </div>
    );
  }
  return <DueDaysForm days={dueDays.days} />;
}

function ClassSummary({
  institute,
}: {
  institute: {
    name: string;
    phone: string | null;
    address: string | null;
  };
}) {
  return (
    <dl className="flex max-w-md flex-col gap-3 text-sm">
      <div>
        <dt className="text-slate">{t("Class name")}</dt>
        <dd>{institute.name}</dd>
      </div>
      <div>
        <dt className="text-slate">{t("Phone")}</dt>
        <dd>{institute.phone ?? t("Not set")}</dd>
      </div>
      <div>
        <dt className="text-slate">{t("Address")}</dt>
        <dd>{institute.address ?? t("Not set")}</dd>
      </div>
      <p className="text-slate">{t("Only the class owner can change these details.")}</p>
    </dl>
  );
}
