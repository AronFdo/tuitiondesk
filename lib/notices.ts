import { colomboToday } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/supabase/session";

export type StaffNotice = {
  id: string;
  body: string;
  postedOn: string;
  showUntil: string | null;
  // Past its last day, so parents no longer see it.
  ended: boolean;
};

// Notices staff have posted to a course, or to the whole class when courseId
// is null. Removed (archived) notices are left out.
export async function loadNotices(
  courseId: string | null,
): Promise<{ ok: true; notices: StaffNotice[] } | { ok: false; missing: boolean }> {
  const staff = await getStaff();
  if (!staff) {
    return { ok: false, missing: false };
  }
  const supabase = await createClient();
  let query = supabase
    .from("notices")
    .select("id, body, created_at, show_until")
    .eq("institute_id", staff.institute.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  query = courseId ? query.eq("course_id", courseId) : query.is("course_id", null);
  const { data, error } = await query;
  if (error) {
    return {
      ok: false,
      missing: error.code === "PGRST205" || error.code === "42P01",
    };
  }
  const today = colomboToday();
  return {
    ok: true,
    notices: (data ?? []).map((notice) => ({
      id: notice.id,
      body: notice.body,
      postedOn: notice.created_at.slice(0, 10),
      showUntil: notice.show_until,
      ended: notice.show_until !== null && notice.show_until < today,
    })),
  };
}
