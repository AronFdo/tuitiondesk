import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { StaffForm } from "@/components/staff/staff-form";
import { loadStaffMember } from "@/lib/staff";
import { t } from "@/lib/t";
import { staffInput } from "@/lib/validation/staff";

type Params = Promise<{ staffId: string }>;

export default function EditStaffPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<p className="text-slate">{t("Loading…")}</p>}>
      <EditStaff params={params} />
    </Suspense>
  );
}

async function EditStaff({ params }: { params: Params }) {
  const { staffId } = await params;
  const result = await loadStaffMember(staffId);
  if (result.status === "signed-out") {
    redirect("/sign-in");
  }
  if (result.status === "forbidden") {
    return <p className="text-slate">{t("Only the class owner can edit staff details.")}</p>;
  }
  if (result.status === "not-found" || (result.status === "ready" && result.member.status !== "active")) {
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
  const { member, allCourses } = result;
  const back = `/staff/${member.id}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={back} className="text-sm text-forest">
          {member.details.full_name}
        </Link>
        <h1 className="mt-1">{t("Edit details")}</h1>
      </div>
      <StaffForm
        staffId={member.id}
        defaults={staffInput(member.details)}
        courses={member.login ? allCourses : undefined}
        initialCourseIds={member.courses.map((course) => course.id)}
        cancelHref={back}
      />
    </div>
  );
}
