import { signedLogoUrl } from "@/lib/institute-logo";
import { paperWidth, type PaperWidth } from "@/lib/receipt-format";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/supabase/session";

export type ReceiptView = {
  id: string;
  receiptNo: number;
  issuedAt: string;
  // Printed before, so this print is a copy.
  copy: boolean;
  voided: boolean;
  totalMinor: number;
  student: { id: string; fullName: string; code: string };
  line: { courseName: string; periodMonth: string; amountMinor: number; paidOn: string };
  receivedBy: string | null;
  institute: {
    name: string;
    address: string | null;
    phone: string | null;
    logoUrl: string | null;
    paper: PaperWidth;
    footer: string | null;
  };
};

const isUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value);

function missingTable(error: { code?: string; message: string }) {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.code === "42703" ||
    error.message.includes("schema cache")
  );
}

export async function loadReceipt(receiptId: string): Promise<
  | { status: "signed-out" }
  | { status: "forbidden" }
  | { status: "not-found" }
  | { status: "error"; missing: boolean }
  | { status: "ready"; receipt: ReceiptView }
> {
  const staff = await getStaff();
  if (!staff) {
    return { status: "signed-out" };
  }
  if (staff.role !== "admin") {
    return { status: "forbidden" };
  }
  if (!isUuid(receiptId)) {
    return { status: "not-found" };
  }

  const supabase = await createClient();
  const instituteId = staff.institute.id;
  const [receiptResult, settingsResult] = await Promise.all([
    supabase
      .from("receipts")
      .select("id, receipt_no, issued_at, issued_by, print_count, voided_at, total_minor, student_id, tuition_payment_id")
      .eq("id", receiptId)
      .eq("institute_id", instituteId)
      .maybeSingle(),
    supabase
      .from("institutes")
      .select("receipt_paper_mm, receipt_footer")
      .eq("id", instituteId)
      .maybeSingle(),
  ]);
  const firstError = receiptResult.error ?? settingsResult.error;
  if (firstError) {
    return { status: "error", missing: missingTable(firstError) };
  }
  const receipt = receiptResult.data;
  if (!receipt) {
    return { status: "not-found" };
  }

  const [paymentResult, studentResult, issuerResult, logoUrl] = await Promise.all([
    supabase
      .from("tuition_payments")
      .select("course_id, amount_minor, paid_on, period_month")
      .eq("id", receipt.tuition_payment_id)
      .maybeSingle(),
    supabase
      .from("students")
      .select("id, full_name, student_code")
      .eq("id", receipt.student_id)
      .maybeSingle(),
    receipt.issued_by
      ? supabase.from("profiles").select("full_name").eq("id", receipt.issued_by).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    signedLogoUrl(staff.institute.logo_path),
  ]);
  if (paymentResult.error || studentResult.error || !paymentResult.data || !studentResult.data) {
    return { status: "error", missing: false };
  }
  const courseResult = await supabase
    .from("courses")
    .select("name")
    .eq("id", paymentResult.data.course_id)
    .maybeSingle();

  return {
    status: "ready",
    receipt: {
      id: receipt.id,
      receiptNo: receipt.receipt_no,
      issuedAt: receipt.issued_at,
      copy: receipt.print_count > 0,
      voided: receipt.voided_at !== null,
      totalMinor: receipt.total_minor,
      student: {
        id: studentResult.data.id,
        fullName: studentResult.data.full_name,
        code: studentResult.data.student_code,
      },
      line: {
        courseName: courseResult.data?.name ?? "",
        periodMonth: paymentResult.data.period_month,
        amountMinor: paymentResult.data.amount_minor,
        paidOn: paymentResult.data.paid_on,
      },
      receivedBy: issuerResult.data?.full_name?.trim() || null,
      institute: {
        name: staff.institute.name,
        address: staff.institute.address,
        phone: staff.institute.phone,
        logoUrl,
        paper: paperWidth(settingsResult.data?.receipt_paper_mm),
        footer: settingsResult.data?.receipt_footer?.trim() || null,
      },
    },
  };
}

// Receipt numbers for a set of payments, for the lists that show them.
export async function receiptsForPayments(
  paymentIds: string[],
): Promise<Map<string, { id: string; receiptNo: number }>> {
  const byPayment = new Map<string, { id: string; receiptNo: number }>();
  if (paymentIds.length === 0) {
    return byPayment;
  }
  const supabase = await createClient();
  // Chunked so a long payment history stays under URL length limits.
  for (let start = 0; start < paymentIds.length; start += 200) {
    const { data, error } = await supabase
      .from("receipts")
      .select("id, receipt_no, tuition_payment_id")
      .in("tuition_payment_id", paymentIds.slice(start, start + 200));
    if (error) {
      // Before 021 runs there are no receipts; the lists simply show none.
      return byPayment;
    }
    for (const row of data ?? []) {
      byPayment.set(row.tuition_payment_id, { id: row.id, receiptNo: row.receipt_no });
    }
  }
  return byPayment;
}
