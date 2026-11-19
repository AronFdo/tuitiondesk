import { signedLogoUrl } from "@/lib/institute-logo";
import { qrSvg } from "@/lib/qr-svg";
import { siteOrigin } from "@/lib/site";
import { cardPayload } from "@/lib/student-card";
import { signedPhotoUrls } from "@/lib/student-photos";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/supabase/session";

export type PrintCard = {
  id: string;
  fullName: string;
  code: string;
  photoUrl: string | null;
  qrSvg: string;
};

const isUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value);
const PAGE = 1000;

// Cards for one student, everyone on a course, or every active student.
// Teachers get only the students the database lets them see.
export async function loadCards(filter: { student?: string; course?: string }): Promise<
  | { status: "signed-out" }
  | { status: "error" }
  | {
      status: "ready";
      title: string;
      instituteName: string;
      logoUrl: string | null;
      cards: PrintCard[];
    }
> {
  const staff = await getStaff();
  if (!staff) {
    return { status: "signed-out" };
  }
  const supabase = await createClient();
  const instituteId = staff.institute.id;
  const columns = "id, full_name, student_code, qr_token, photo_path";

  let title = "All students";
  let rows: { id: string; full_name: string; student_code: string; qr_token: string; photo_path: string | null }[] = [];

  if (filter.student) {
    if (!isUuid(filter.student)) {
      return { status: "error" };
    }
    const { data, error } = await supabase
      .from("students")
      .select(columns)
      .eq("id", filter.student)
      .eq("institute_id", instituteId)
      .eq("status", "active");
    if (error) {
      return { status: "error" };
    }
    rows = data ?? [];
    title = rows[0]?.full_name ?? "Student card";
  } else if (filter.course) {
    if (!isUuid(filter.course)) {
      return { status: "error" };
    }
    const [courseResult, enrollmentResult] = await Promise.all([
      supabase.from("courses").select("name").eq("id", filter.course).eq("institute_id", instituteId).maybeSingle(),
      supabase
        .from("enrollments")
        .select("student_id")
        .eq("institute_id", instituteId)
        .eq("course_id", filter.course)
        .is("end_date", null),
    ]);
    if (courseResult.error || enrollmentResult.error || !courseResult.data) {
      return { status: "error" };
    }
    title = courseResult.data.name;
    const ids = (enrollmentResult.data ?? []).map((row) => row.student_id);
    if (ids.length > 0) {
      const { data, error } = await supabase
        .from("students")
        .select(columns)
        .in("id", ids)
        .eq("status", "active")
        .order("full_name");
      if (error) {
        return { status: "error" };
      }
      rows = data ?? [];
    }
  } else {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("students")
        .select(columns)
        .eq("institute_id", instituteId)
        .eq("status", "active")
        .order("full_name")
        .order("id")
        .range(from, from + PAGE - 1);
      if (error) {
        return { status: "error" };
      }
      rows.push(...(data ?? []));
      if ((data ?? []).length < PAGE) {
        break;
      }
    }
  }

  const [logoUrl, photos, svgs] = await Promise.all([
    signedLogoUrl(staff.institute.logo_path),
    // Long enough to print a big batch.
    signedPhotoUrls(supabase, rows.map((row) => row.photo_path), 60 * 60),
    siteOrigin().then((origin) =>
      Promise.all(rows.map((row) => qrSvg(cardPayload(row.qr_token, origin)))),
    ),
  ]);

  return {
    status: "ready",
    title,
    instituteName: staff.institute.name,
    logoUrl,
    cards: rows.map((row, index) => ({
      id: row.id,
      fullName: row.full_name,
      code: row.student_code,
      photoUrl: row.photo_path ? (photos.get(row.photo_path) ?? null) : null,
      qrSvg: svgs[index],
    })),
  };
}
