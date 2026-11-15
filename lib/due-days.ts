import { createClient } from "@/lib/supabase/server";

export type DueDays = {
  tuitionDueDay: string;
};

function dayInput(value: number | null | undefined) {
  return value ? String(value) : "";
}

export async function loadDueDays(
  instituteId: string,
): Promise<{ status: "ready"; days: DueDays } | { status: "missing" } | { status: "error" }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("institutes")
    .select("tuition_due_day")
    .eq("id", instituteId)
    .maybeSingle();

  if (error) {
    const missing =
      error.code === "42703" ||
      error.code === "PGRST204" ||
      error.message.includes("tuition_due_day") ||
      error.message.includes("schema cache");
    return { status: missing ? "missing" : "error" };
  }
  if (!data) {
    return { status: "error" };
  }

  return {
    status: "ready",
    days: {
      tuitionDueDay: dayInput(data.tuition_due_day),
    },
  };
}
