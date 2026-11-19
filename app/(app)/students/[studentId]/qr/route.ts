import { attachmentHeader, qrFileName } from "@/lib/qr-download";
import { qrPng } from "@/lib/qr-png";
import { siteOrigin } from "@/lib/site";
import { cardPayload } from "@/lib/student-card";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/supabase/session";
import { t } from "@/lib/t";

// The student's card QR as a PNG named after them. Any staff member who can
// open the student's page can download it; the database hides students a
// teacher does not teach. The code checks people in, so it is never cached.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  const staff = await getStaff();
  if (!staff) {
    return text(t("Sign in to continue."), 401);
  }
  if (!/^[0-9a-f-]{36}$/i.test(studentId)) {
    return text(t("That student is not in this class."), 404);
  }

  const { data: student } = await (await createClient())
    .from("students")
    .select("full_name, student_code, qr_token, status")
    .eq("id", studentId)
    .eq("institute_id", staff.institute.id)
    .maybeSingle();
  if (!student || student.status === "archived") {
    return text(t("That student is not in this class."), 404);
  }

  const png = await qrPng(cardPayload(student.qr_token, await siteOrigin()));
  const fileName = qrFileName(student.full_name, student.student_code);
  return new Response(png as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": attachmentHeader(fileName, `${student.student_code || "student"}.png`),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function text(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
