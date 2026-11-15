"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import { playScanSound } from "@/components/attendance/sounds";
import { useScanner } from "@/components/attendance/use-scanner";
import { SelectField, TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { cancelClassName, ConfirmDialog, FormDialog } from "@/components/ui/form-dialog";
import { recordTuitionPayment, voidTuitionPayment } from "@/lib/actions/fees";
import { findStudentByCard } from "@/lib/actions/receipts";
import { formatDate, formatMonth, previousMonth } from "@/lib/dates";
import { formatLkr, minorToLkrInput } from "@/lib/money";
import type { CourseOption, EnrolledStudent, TuitionPaymentItem } from "@/lib/payments";
import { formatReceiptNo } from "@/lib/receipt-format";
import { t } from "@/lib/t";
import type { TuitionPaymentInput } from "@/lib/validation/fees";

type Pick = { courseId: string; studentId: string };

function receiptHref(receiptId: string, print: boolean) {
  return `/receipts/${receiptId}${print ? "?print=1" : ""}`;
}

export function TuitionPanel({
  payments,
  courses,
  students,
  today,
  preselectStudentId,
}: {
  payments: TuitionPaymentItem[];
  courses: CourseOption[];
  students: EnrolledStudent[];
  today: string;
  // From a student's page: open the form with them already chosen.
  preselectStudentId?: string | null;
}) {
  const router = useRouter();
  const firstCourseOf = useCallback(
    (studentId: string, courseIds?: string[]) => {
      const onCourses = students.filter((student) => student.id === studentId).map((student) => student.courseId);
      const choices = courseIds ? onCourses.filter((id) => courseIds.includes(id)) : onCourses;
      return choices[0] ?? "";
    },
    [students],
  );
  const [adding, setAdding] = useState<Pick | null>(() => {
    const courseId = preselectStudentId ? firstCourseOf(preselectStudentId) : "";
    return preselectStudentId && courseId ? { courseId, studentId: preselectStudentId } : null;
  });
  const [deleting, setDeleting] = useState<TuitionPaymentItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const saving = useRef(false);

  // A student's card scanned at the desk opens the form for them.
  const onScan = useCallback(
    async (scanned: string) => {
      setScanNotice(null);
      const result = await findStudentByCard({ scanned }).catch(() => null);
      if (!result?.ok) {
        setScanNotice(result?.error ?? t("No connection. Scan the card again when you are back online."));
        playScanSound("problem");
        return;
      }
      if (!result.data) {
        setScanNotice(t("Card not recognised. It may have been replaced by a new one."));
        playScanSound("problem");
        return;
      }
      const courseId = firstCourseOf(result.data.studentId, result.data.courseIds);
      if (!courseId) {
        setScanNotice(`${result.data.fullName} ${t("is not on a course, so there is no tuition to record.")}`);
        playScanSound("problem");
        return;
      }
      playScanSound("ok");
      setAdding({ courseId, studentId: result.data.studentId });
    },
    [firstCourseOf],
  );
  useScanner(
    useCallback((text: string) => void onScan(text), [onScan]),
    adding === null && deleting === null,
  );

  async function confirmDelete() {
    if (!deleting || saving.current) {
      return;
    }
    saving.current = true;
    setDeleteError(null);
    setPending(true);
    const result = await voidTuitionPayment({ paymentId: deleting.id });
    saving.current = false;
    setPending(false);
    if (!result.ok) {
      setDeleteError(result.error);
      return;
    }
    setDeleting(null);
    router.refresh();
  }

  return (
    <div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate">{t("Scan a student's card to record their payment.")}</p>
        <Button type="button" className="h-11" onClick={() => setAdding({ courseId: "", studentId: "" })}>
          {t("Record payment")}
        </Button>
      </div>
      <p role="status" className="mt-2 text-sm text-[var(--status-overdue-fg)]">
        {scanNotice}
      </p>
      {payments.length === 0 ? (
        <p className="mt-6 text-slate">{t("No tuition fees yet. Record one, or scan a card to start.")}</p>
      ) : (
        <ul className="mt-2">
          {payments.map((payment) => (
            <li key={payment.id} className="flex items-center border-b border-line">
              <div className="row mr-0! min-w-0 flex-1 justify-between gap-3">
                <span className="min-w-0">
                  <span className="block break-words text-ink">{payment.studentName}</span>
                  <span className="block break-words text-sm text-slate">
                    {payment.courseName} · {formatMonth(payment.periodMonth)} · {formatDate(payment.paidOn)}
                    {payment.receipt ? (
                      <span className="tabular">{` · ${t("No.")} ${formatReceiptNo(payment.receipt.receiptNo)}`}</span>
                    ) : null}
                  </span>
                </span>
                <span className="tabular shrink-0 text-sm text-ink">{formatLkr(payment.amountMinor)}</span>
              </div>
              {payment.receipt ? (
                <a
                  href={receiptHref(payment.receipt.id, false)}
                  target="_blank"
                  rel="noopener"
                  aria-label={`${t("Receipt")}, ${payment.studentName}, ${formatMonth(payment.periodMonth)}`}
                  className="flex h-11 items-center px-2 text-sm font-medium text-forest"
                >
                  {t("Receipt")}
                </a>
              ) : null}
              <button
                type="button"
                aria-label={`${t("Delete")}, ${payment.studentName}, ${formatMonth(payment.periodMonth)}`}
                className="h-11 px-2 text-sm font-medium text-destructive"
                onClick={() => {
                  setDeleteError(null);
                  setDeleting(payment);
                }}
              >
                {t("Delete")}
              </button>
            </li>
          ))}
        </ul>
      )}
      <FormDialog
        open={adding !== null}
        title={t("Record tuition fee")}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(null);
          }
        }}
      >
        {adding ? (
          <TuitionForm
            key={`${adding.courseId}:${adding.studentId}`}
            initial={adding}
            courses={courses}
            students={students}
            today={today}
            onClose={() => setAdding(null)}
          />
        ) : null}
      </FormDialog>
      <ConfirmDialog
        open={deleting !== null}
        title={
          deleting
            ? `${t("Delete")} ${deleting.studentName}${t("'s payment for")} ${formatMonth(deleting.periodMonth)}?`
            : t("Delete payment?")
        }
        body={t("It leaves the list and the totals, and its receipt is marked VOID. Record it again if the amount was wrong.")}
        confirmLabel={t("Delete payment")}
        pending={pending}
        error={deleteError}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
          }
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function TuitionForm({
  initial,
  courses,
  students,
  today,
  onClose,
}: {
  initial: Pick;
  courses: CourseOption[];
  students: EnrolledStudent[];
  today: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<{ receiptId: string; receiptNo: number; studentName: string } | null>(null);
  const saving = useRef(false);
  const feeFor = (courseId: string) => {
    const fee = courses.find((course) => course.id === courseId)?.monthlyFeeMinor ?? 0;
    return minorToLkrInput(fee);
  };
  const form = useForm<TuitionPaymentInput>({
    defaultValues: {
      courseId: initial.courseId,
      studentId: initial.studentId,
      amount: feeFor(initial.courseId),
      paidOn: today,
      // Paid in arrears: a payment today is usually for last month.
      periodMonth: previousMonth(today),
    },
  });
  const courseId = useWatch({ control: form.control, name: "courseId" });
  const enrolled = useMemo(
    () => students.filter((student) => student.courseId === courseId),
    [students, courseId],
  );

  if (saved) {
    return (
      <div className="flex flex-col gap-4">
        <div role="status">
          <p className="font-medium text-ink">{t("Payment recorded")}</p>
          <p className="tabular text-slate">{`${saved.studentName} · ${t("Receipt No.")} ${formatReceiptNo(saved.receiptNo)}`}</p>
        </div>
        <a
          href={receiptHref(saved.receiptId, true)}
          target="_blank"
          rel="noopener"
          className="press inline-flex h-11 items-center justify-center rounded-lg bg-forest px-4 text-sm font-medium text-white"
        >
          {t("Print receipt")}
        </a>
        <button type="button" className={cancelClassName()} onClick={onClose}>
          {t("Done")}
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        void form.handleSubmit(async (values) => {
          if (saving.current) {
            return;
          }
          saving.current = true;
          setError(null);
          setPending(true);
          const result = await recordTuitionPayment(values).catch(() => null);
          saving.current = false;
          setPending(false);
          if (!result?.ok) {
            setError(result?.error ?? t("No connection. That payment was not saved. Try again when you are back online."));
            return;
          }
          setSaved({
            receiptId: result.data.receiptId,
            receiptNo: result.data.receiptNo,
            studentName: students.find((student) => student.id === values.studentId)?.fullName ?? "",
          });
          router.refresh();
        })(event);
      }}
    >
      <SelectField
        label={t("Course")}
        {...form.register("courseId", {
          onChange: (event) => {
            const next = event.target.value;
            // Keep the chosen student when they are on the new course too.
            const studentId = form.getValues("studentId");
            if (!students.some((student) => student.id === studentId && student.courseId === next)) {
              form.setValue("studentId", "");
            }
            form.setValue("amount", feeFor(next));
          },
        })}
      >
        <option value="">{t("Choose a course")}</option>
        {courses.map((course) => (
          <option key={course.id} value={course.id}>
            {course.name}
          </option>
        ))}
      </SelectField>
      <SelectField label={t("Student")} {...form.register("studentId")}>
        <option value="">{t("Choose a student")}</option>
        {enrolled.map((student) => (
          <option key={student.id} value={student.id}>
            {student.fullName}
          </option>
        ))}
      </SelectField>
      <TextField label={t("Month")} type="month" {...form.register("periodMonth")} />
      <TextField label={t("Amount")} inputMode="decimal" placeholder="12500" {...form.register("amount")} />
      <TextField label={t("Paid on")} type="date" {...form.register("paidOn")} />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex gap-3">
        <button type="button" className={cancelClassName()} onClick={onClose}>
          {t("Cancel")}
        </button>
        <Button type="submit" className="h-11 flex-1" disabled={pending}>
          {pending ? t("Saving…") : t("Save and make receipt")}
        </Button>
      </div>
    </form>
  );
}
