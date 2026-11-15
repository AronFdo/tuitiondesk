import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { StaffForm } from "@/components/staff/staff-form";
import { can } from "@/lib/permissions";
import { getStaff } from "@/lib/supabase/session";
import { t } from "@/lib/t";

export default function NewStaffPage() {
  return (
    <Suspense fallback={<p className="text-slate">{t("Loading…")}</p>}>
      <NewStaff />
    </Suspense>
  );
}

async function NewStaff() {
  const staff = await getStaff();
  if (!staff) {
    redirect("/sign-in");
  }
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/staff" className="text-sm text-forest">
          {t("Staff")}
        </Link>
        <h1 className="mt-1">{t("Add a staff member")}</h1>
      </div>
      {can(staff, "staff.manage") ? (
        <>
          <p className="max-w-xl text-slate">
            {t("Only their name is needed now. You can give them a login to the app afterwards.")}
          </p>
          <StaffForm cancelHref="/staff" />
        </>
      ) : (
        <p className="text-slate">{t("Only the class owner can add staff.")}</p>
      )}
    </div>
  );
}
