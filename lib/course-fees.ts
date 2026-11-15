import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type CourseFee = { monthlyFeeMinor: number; tuitionDueDay: number | null };

// Course fees are not readable from public.courses (supabase/sql/024). This
// reads them through course_fees(), which returns rows only to staff with
// fees.view and to a parent for their own child's courses; anyone else gets an
// empty map.
export async function loadCourseFees(
  supabase: SupabaseClient<Database>,
  courseIds: string[],
): Promise<
  | { ok: true; fees: Map<string, CourseFee> }
  | { ok: false; error: { code?: string; message: string } }
> {
  const fees = new Map<string, CourseFee>();
  if (courseIds.length === 0) {
    return { ok: true, fees };
  }
  const { data, error } = await supabase.rpc("course_fees", { p_course_ids: courseIds });
  if (error) {
    return { ok: false, error };
  }
  for (const row of data ?? []) {
    fees.set(row.course_id, {
      monthlyFeeMinor: row.monthly_fee_minor,
      tuitionDueDay: row.tuition_due_day,
    });
  }
  return { ok: true, fees };
}
