import { loadImportContext } from "@/lib/student-import-context";
import { templateCsv } from "@/lib/student-import";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/supabase/session";
import { t } from "@/lib/t";
import { can } from "@/lib/permissions";

// The CSV template for bulk import, filled with this class's course names.
// Sent as a real file download so it works in every browser, Safari included.
export async function GET() {
  const staff = await getStaff();
  if (!staff || !can(staff, "students.manage")) {
    return new Response(t("Only the class owner can add students."), {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const context = await loadImportContext(await createClient(), staff.institute.id);
  const courseNames = context.ok ? context.courses.map((course) => course.name) : [];

  return new Response(templateCsv(courseNames), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="tuitiondesk-students.csv"',
      "Cache-Control": "no-store",
    },
  });
}
