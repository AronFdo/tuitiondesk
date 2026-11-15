"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StudentAvatar } from "@/components/students/student-avatar";
import { ConfirmDialog } from "@/components/ui/form-dialog";
import { RowActions } from "@/components/ui/row-actions";
import { archiveStudent } from "@/lib/actions/courses";
import { t } from "@/lib/t";

export type ManagedStudent = {
  id: string;
  fullName: string;
  code?: string | null;
  photoUrl?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  courses?: { id: string; name: string }[];
};

export function StudentManager({
  courseId,
  students,
  canEdit,
  heading,
  empty,
  searchable = false,
}: {
  courseId?: string;
  students: ManagedStudent[];
  canEdit: boolean;
  heading?: string;
  empty: string;
  searchable?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState<ManagedStudent | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);

  const shown = useMemo(() => filterStudents(students, query), [students, query]);

  async function confirmDelete() {
    if (!deleting || saving.current) {
      return;
    }
    saving.current = true;
    setDeleteError(null);
    setPending(true);
    const result = await archiveStudent({ studentId: deleting.id });
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
    <section>
      {heading || (canEdit && courseId) ? (
        <div className="flex items-center justify-between gap-4">
          {heading ? <h2>{heading}</h2> : <span />}
          {canEdit && courseId ? (
            <Link
              href={`/students/new?course=${courseId}`}
              className="press inline-flex h-11 items-center justify-center rounded-lg bg-forest px-4 text-sm font-medium text-white"
            >
              {t("Add student")}
            </Link>
          ) : null}
        </div>
      ) : null}
      {searchable && students.length > 0 ? (
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("Search by name, code or phone")}
          aria-label={t("Search students")}
          className="mt-6 h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-base text-ink focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest md:max-w-sm"
        />
      ) : null}
      {students.length === 0 ? (
        <p className={heading ? "mt-2 text-slate" : "mt-6 text-slate"}>{empty}</p>
      ) : shown.length === 0 ? (
        <p className="mt-4 text-slate">{t("No student matches that search.")}</p>
      ) : (
        <ul className={heading ? "mt-2" : searchable ? "mt-2" : "mt-6"}>
          {shown.map((student) => (
            <li key={student.id} className="flex min-h-16 items-center gap-3 border-b border-line">
              <Link
                href={`/students/${student.id}`}
                className="pressable -mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-3"
              >
                <StudentAvatar name={student.fullName} photoUrl={student.photoUrl} size="sm" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-ink">{student.fullName}</span>
                  {student.code ? (
                    <span className="tabular truncate text-sm text-slate">
                      {student.code}
                      {student.courses && student.courses.length > 0
                        ? ` · ${student.courses.map((course) => course.name).join(", ")}`
                        : ""}
                    </span>
                  ) : null}
                </span>
              </Link>
              {canEdit ? (
                <RowActions
                  itemName={student.fullName}
                  onEdit={() => router.push(`/students/${student.id}/edit`)}
                  onDelete={() => {
                    setDeleteError(null);
                    setDeleting(student);
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `${t("Delete")} ${deleting.fullName}?` : t("Delete student?")}
        body={t("They leave all their courses and the student list. Their payments and attendance stay on record.")}
        confirmLabel={t("Delete student")}
        pending={pending}
        error={deleteError}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setDeleting(null);
          }
        }}
        onConfirm={confirmDelete}
      />
    </section>
  );
}

function filterStudents(students: ManagedStudent[], query: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return students;
  }
  const digits = query.replace(/\D/g, "");
  return students.filter((student) => {
    const haystack = `${student.fullName} ${student.code ?? ""}`.toLowerCase();
    if (words.every((word) => haystack.includes(word))) {
      return true;
    }
    // 0771234567 should find +94771234567.
    const phone = (student.guardianPhone ?? "").replace(/\D/g, "");
    return digits.length >= 4 && phone.includes(digits.replace(/^0/, ""));
  });
}
