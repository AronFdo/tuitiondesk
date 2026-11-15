import { can } from "@/lib/permissions";
import { describeHistory, type HistoryEntry } from "@/lib/student-history-format";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/supabase/session";

const LIMIT = 200;

// A student's change log, newest first. Staff without students.history get
// "forbidden"; RLS on activity_log enforces the same rule.
export async function loadStudentHistory(studentId: string): Promise<
  | { status: "forbidden" }
  | { status: "error"; missing: boolean }
  | { status: "ready"; entries: HistoryEntry[]; more: boolean }
> {
  const staff = await getStaff();
  if (!staff || !can(staff, "students.history") || !/^[0-9a-f-]{36}$/i.test(studentId)) {
    return { status: "forbidden" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_log")
    .select("id, action, data, created_at, actor_profile_id")
    .eq("institute_id", staff.institute.id)
    .eq("entity", "students")
    .eq("entity_id", studentId)
    .order("created_at", { ascending: false })
    .limit(LIMIT + 1);
  if (error) {
    return {
      status: "error",
      missing: error.code === "PGRST205" || error.code === "42P01",
    };
  }
  const rows = (data ?? []).slice(0, LIMIT);

  // Rows written before 025, or by the app, may not carry the actor's name.
  const unnamed = [
    ...new Set(
      rows
        .filter((row) => !(row.data as { actor_name?: unknown } | null)?.actor_name)
        .map((row) => row.actor_profile_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const names = new Map<string, string>();
  if (unnamed.length > 0) {
    const profiles = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", unnamed);
    for (const profile of profiles.data ?? []) {
      const name = profile.full_name?.trim() || profile.email;
      if (name) {
        names.set(profile.id, name);
      }
    }
  }

  return {
    status: "ready",
    entries: rows.map((row) => describeHistory(row, names)),
    more: (data ?? []).length > LIMIT,
  };
}
