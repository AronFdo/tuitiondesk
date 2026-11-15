"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SelectField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { importStudents, uploadStudentPhoto } from "@/lib/actions/students";
import { formatDate } from "@/lib/dates";
import { matchPhotos, type PhotoMatches } from "@/lib/photo-match";
import { squarePhoto } from "@/lib/photo-resize";
import {
  importableRows,
  readStudentSheet,
  type ExistingStudent,
  type ImportCourse,
  type ImportRow,
} from "@/lib/student-import";
import { t } from "@/lib/t";

const maxFileBytes = 1_000_000;
const maxPhotos = 1000;
// Photos upload a few at a time: quick, without flooding a slow connection.
const PARALLEL_UPLOADS = 3;

type PhotoTask = { line: number; studentId: string; fullName: string; file: File };
type Failed = PhotoTask & { reason: string };
type Done = { added: number; skipped: number; photosAdded: number; failed: Failed[] };

export function StudentImport({
  courses,
  existing,
  today,
}: {
  courses: ImportCourse[];
  existing: ExistingStudent[];
  today: string;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [defaultCourseId, setDefaultCourseId] = useState("");
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const saving = useRef(false);

  const sheet = useMemo(
    () => (csv === null ? null : readStudentSheet(csv, { courses, existing, today, defaultCourseId })),
    [csv, courses, existing, today, defaultCourseId],
  );
  const rows = useMemo(() => (sheet?.ok ? sheet.rows : []), [sheet]);
  const matches: PhotoMatches = useMemo(
    () => matchPhotos(rows, photos.map((photo) => photo.name)),
    [rows, photos],
  );
  const filesByName = useMemo(() => new Map(photos.map((photo) => [photo.name, photo])), [photos]);
  // Small previews; the browser only decodes the ones scrolled into view.
  // They are released when the photos are replaced or cleared.
  const previews = useMemo(
    () => new Map(photos.map((photo) => [photo.name, URL.createObjectURL(photo)])),
    [photos],
  );
  function replacePhotos(next: File[]) {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setPhotos(next);
  }

  // Leaving mid-upload would strand the rest of the photos.
  useEffect(() => {
    if (!progress) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [progress]);

  const problems = rows.filter((row) => row.errors.length > 0).length;
  const duplicates = rows.filter((row) => row.errors.length === 0 && row.duplicate).length;
  const toAdd = importableRows(rows, includeDuplicates);
  const ready = toAdd.length;
  const withPhoto = toAdd.filter((row) => matches.byLine.get(row.line)?.fileName).length;
  const shown = onlyProblems ? rows.filter((row) => row.errors.length > 0) : rows;

  async function chooseFile(file: File | undefined) {
    setSaveError(null);
    setDone(null);
    if (!file) {
      return;
    }
    if (file.size > maxFileBytes) {
      setFileError(t("That file is too large. Bring in up to 1000 students at a time."));
      return;
    }
    if (/\.(xlsx?|numbers|ods)$/i.test(file.name)) {
      setFileError(t("Save the spreadsheet as CSV first (File › Save As › CSV), then choose that file."));
      return;
    }
    setFileError(null);
    setFileName(file.name);
    setCsv(await file.text());
    setOnlyProblems(false);
  }

  function choosePhotos(list: FileList | null) {
    const chosen = Array.from(list ?? []).filter(
      (file) => file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name),
    );
    if (chosen.length > maxPhotos) {
      setFileError(t("Choose up to 1000 photos at a time."));
      return;
    }
    setFileError(null);
    replacePhotos(chosen);
  }

  async function uploadAll(tasks: PhotoTask[]): Promise<Failed[]> {
    const failed: Failed[] = [];
    let next = 0;
    let finished = 0;
    setProgress({ done: 0, total: tasks.length });
    async function worker() {
      while (next < tasks.length) {
        const task = tasks[next];
        next += 1;
        try {
          const blob = await squarePhoto(task.file);
          const formData = new FormData();
          formData.set("studentId", task.studentId);
          formData.set("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }));
          const result = await uploadStudentPhoto(formData);
          if (!result.ok) {
            failed.push({ ...task, reason: result.error });
          }
        } catch {
          failed.push({
            ...task,
            reason: /\.(heic|heif)$/i.test(task.file.name)
              ? t("This browser cannot read HEIC photos. Export it as JPEG and try again.")
              : t("This photo could not be read or sent. Check your connection and try again."),
          });
        }
        finished += 1;
        setProgress({ done: finished, total: tasks.length });
      }
    }
    await Promise.all(Array.from({ length: Math.min(PARALLEL_UPLOADS, tasks.length) }, worker));
    setProgress(null);
    return failed.sort((a, b) => a.line - b.line);
  }

  async function save() {
    if (!csv || saving.current || problems > 0 || ready === 0) {
      return;
    }
    saving.current = true;
    setPending(true);
    setSaveError(null);
    const result = await importStudents({ csv, defaultCourseId, includeDuplicates }).catch(() => null);
    setPending(false);
    if (!result?.ok) {
      saving.current = false;
      setSaveError(result?.error ?? t("No connection. Nothing was saved. Try again when you are back online."));
      return;
    }

    const names = new Map(rows.map((row) => [row.line, row.fullName]));
    const tasks = result.data.students.flatMap((student) => {
      const fileName = matches.byLine.get(student.line)?.fileName;
      const file = fileName ? filesByName.get(fileName) : undefined;
      return file ? [{ ...student, fullName: names.get(student.line) ?? "", file }] : [];
    });
    const failed = tasks.length > 0 ? await uploadAll(tasks) : [];
    saving.current = false;
    setDone({
      added: result.data.added,
      skipped: result.data.skipped,
      photosAdded: tasks.length - failed.length,
      failed,
    });
    setCsv(null);
    setFileName(null);
    replacePhotos([]);
    router.refresh();
  }

  async function retryFailed() {
    if (!done || saving.current) {
      return;
    }
    saving.current = true;
    const failed = await uploadAll(done.failed);
    saving.current = false;
    setDone({ ...done, photosAdded: done.photosAdded + done.failed.length - failed.length, failed });
    router.refresh();
  }

  if (progress) {
    return (
      <div className="flex max-w-xl flex-col gap-3">
        <p className="font-medium text-ink">{t("Students added. Uploading photos…")}</p>
        <progress
          className="h-2 w-full overflow-hidden rounded-full accent-forest"
          max={progress.total}
          value={progress.done}
          aria-label={t("Photos uploaded")}
        />
        <p role="status" className="tabular text-sm text-slate">
          {`${progress.done} ${t("of")} ${progress.total} ${t("photos uploaded")}`}
        </p>
        <p className="text-sm text-slate">{t("Keep this page open until it finishes.")}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex max-w-xl flex-col gap-4">
        <div role="status">
          <p className="text-ink">
            {done.added === 1 ? t("1 student added.") : `${done.added} ${t("students added.")}`}
            {done.skipped > 0 ? ` ${done.skipped} ${t("skipped.")}` : ""}
          </p>
          {done.photosAdded > 0 || done.failed.length > 0 ? (
            <p className="text-ink">
              {done.photosAdded === 1 ? t("1 photo added.") : `${done.photosAdded} ${t("photos added.")}`}
            </p>
          ) : null}
        </div>
        {done.failed.length > 0 ? (
          <section className="rounded-lg border border-[var(--status-overdue-fg)] bg-[var(--status-overdue-bg)] p-4">
            <h2 className="text-base text-[var(--status-overdue-fg)]">
              {done.failed.length === 1 ? t("1 photo was not added") : `${done.failed.length} ${t("photos were not added")}`}
            </h2>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-ink">
              {done.failed.map((item) => (
                <li key={item.line}>
                  <Link href={`/students/${item.studentId}`} className="font-medium text-forest">
                    {item.fullName}
                  </Link>
                  {` · ${item.file.name} · ${item.reason}`}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="press mt-3 inline-flex h-11 items-center justify-center rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-forest"
              onClick={() => void retryFailed()}
            >
              {t("Try these photos again")}
            </button>
          </section>
        ) : null}
        <p className="text-sm text-slate">
          {t("Each student has a code and QR card now. Add any missing photos from their pages, then print the cards.")}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/students"
            className="press inline-flex h-11 items-center justify-center rounded-lg bg-forest px-4 text-sm font-medium text-white"
          >
            {t("See students")}
          </Link>
          <a
            href="/cards"
            target="_blank"
            rel="noopener"
            className="press inline-flex h-11 items-center justify-center rounded-lg border border-line bg-surface px-4 text-sm font-medium text-forest"
          >
            {t("Print cards")}
          </a>
          <button
            type="button"
            className="press inline-flex h-11 items-center justify-center rounded-lg border border-line bg-surface px-4 text-sm font-medium text-forest"
            onClick={() => setDone(null)}
          >
            {t("Import another file")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex max-w-xl flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <div>
          <h2 className="text-base">{t("Start from the template")}</h2>
          <p className="mt-1 text-sm text-slate">
            {t("A spreadsheet with the right columns and two example rows that use your course names. Opens in Excel, Numbers or Google Sheets.")}
          </p>
        </div>
        <a
          href="/students/import/template"
          download
          className="press inline-flex h-11 w-fit items-center justify-center rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-forest"
        >
          {t("Download template")}
        </a>
      </section>

      <ol className="flex max-w-xl list-decimal flex-col gap-2 pl-5 text-slate">
        <li>
          {t("Fill in the template, or use your own sheet. Only first name (or name), date of birth and gender are needed; leave the rest empty if you do not have them.")}
        </li>
        <li>
          {t("Religion, special needs, O/L and A/L results, qualification and occupations are best added on each student's page. If your sheet already has those columns, they are read too.")}
        </li>
        <li>{t("Put one student on each row and delete the two example rows. Dates like 18/04/2012 work.")}</li>
        <li>
          {t("For courses, use the course name as it is here. Separate more than one with a semicolon.")}
        </li>
        <li>
          {t("Photos are optional. Put each photo's file name in the Photo column, or name the photo files after the students, like Nimal Perera.jpg.")}
        </li>
        <li>{t("Save it as CSV, then choose it and the photos below. Nothing is saved until you confirm.")}</li>
      </ol>

      <div className="flex max-w-xl flex-col gap-4">
        {courses.length > 0 ? (
          <SelectField
            label={t("Course for rows with no course")}
            name="defaultCourse"
            value={defaultCourseId}
            onChange={(event) => setDefaultCourseId(event.target.value)}
          >
            <option value="">{t("None, leave them off a course")}</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </SelectField>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv,text/plain,.txt"
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              void chooseFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <Button type="button" className="h-11 px-4" onClick={() => fileInput.current?.click()}>
            {fileName ? t("Choose another CSV file") : t("Choose CSV file")}
          </Button>
          {fileName ? <span className="min-w-0 break-all text-sm text-slate">{fileName}</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={photoInput}
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              choosePhotos(event.target.files);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className="press inline-flex h-11 items-center justify-center rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-forest"
            onClick={() => photoInput.current?.click()}
          >
            {photos.length > 0 ? t("Choose other photos") : t("Choose photos (optional)")}
          </button>
          {photos.length > 0 ? (
            <>
              <span className="tabular text-sm text-slate">
                {photos.length === 1 ? t("1 photo chosen") : `${photos.length} ${t("photos chosen")}`}
              </span>
              <button type="button" className="h-11 px-2 text-sm text-slate" onClick={() => replacePhotos([])}>
                {t("Clear photos")}
              </button>
            </>
          ) : null}
        </div>
        <p className="text-sm text-slate">
          {t("Select all the photos at once. On a computer, open the folder and press Ctrl+A (Cmd+A on a Mac).")}
        </p>
        {fileError ? (
          <p role="alert" className="text-sm text-destructive">
            {fileError}
          </p>
        ) : null}
        {sheet && !sheet.ok ? (
          <p role="alert" className="text-sm text-destructive">
            {t(sheet.error)}
          </p>
        ) : null}
      </div>

      {sheet?.ok ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Count label={t("Ready to add")} value={ready} />
            <Count label={t("With problems")} value={problems} tone={problems > 0 ? "bad" : undefined} />
            <Count label={t("Already here")} value={duplicates} tone={duplicates > 0 ? "warn" : undefined} />
            {photos.length > 0 ? <Count label={t("With a photo")} value={withPhoto} /> : null}
          </div>
          {sheet.ignoredColumns.length > 0 ? (
            <p className="text-sm text-slate">{`${t("Not imported:")} ${sheet.ignoredColumns.join(", ")}`}</p>
          ) : null}
          {matches.unused.length > 0 && photos.length > 0 ? (
            <details className="max-w-xl text-sm text-ink">
              <summary className="min-h-11 cursor-pointer py-3 text-[var(--status-due-fg)]">
                {matches.unused.length === 1
                  ? t("1 photo matches no student")
                  : `${matches.unused.length} ${t("photos match no student")}`}
              </summary>
              <p className="text-slate">
                {t("Check the spelling in the Photo column, or rename the file after the student.")}
              </p>
              <ul className="mt-2 flex flex-col gap-1 break-all text-slate">
                {matches.unused.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </details>
          ) : null}
          {problems > 0 ? (
            <p className="max-w-xl text-sm text-ink">
              {t("Fix the rows marked below in your spreadsheet, save it as CSV again and choose it here.")}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {problems > 0 ? (
              <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="size-4 accent-forest"
                  checked={onlyProblems}
                  onChange={(event) => setOnlyProblems(event.target.checked)}
                />
                {t("Show only rows with problems")}
              </label>
            ) : null}
            {duplicates > 0 ? (
              <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="size-4 accent-forest"
                  checked={includeDuplicates}
                  onChange={(event) => setIncludeDuplicates(event.target.checked)}
                />
                {t("Add students who look already here anyway")}
              </label>
            ) : null}
          </div>

          <PreviewTable
            rows={shown}
            includeDuplicates={includeDuplicates}
            matches={matches}
            previews={previews}
            photosChosen={photos.length > 0}
          />

          {saveError ? (
            <p role="alert" className="text-sm text-destructive">
              {saveError}
            </p>
          ) : null}
          <div>
            <Button
              type="button"
              className="h-11 px-5"
              disabled={pending || problems > 0 || ready === 0}
              onClick={() => void save()}
            >
              {pending
                ? t("Adding…")
                : withPhoto > 0
                  ? `${t("Add")} ${ready} ${ready === 1 ? t("student") : t("students")} ${t("and")} ${withPhoto} ${withPhoto === 1 ? t("photo") : t("photos")}`
                  : ready === 1
                    ? t("Add 1 student")
                    : `${t("Add")} ${ready} ${t("students")}`}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone?: "bad" | "warn" }) {
  const color = tone === "bad" ? "text-destructive" : tone === "warn" ? "text-[var(--status-due-fg)]" : "text-forest";
  return (
    <div>
      <p className={`figure ${color}`}>{value}</p>
      <p className="figure-label text-slate">{label}</p>
    </div>
  );
}

function PreviewTable({
  rows,
  includeDuplicates,
  matches,
  previews,
  photosChosen,
}: {
  rows: ImportRow[];
  includeDuplicates: boolean;
  matches: PhotoMatches;
  previews: Map<string, string>;
  photosChosen: boolean;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line text-slate">
            <th className="py-2 pr-3 font-medium">{t("Row")}</th>
            {photosChosen ? <th className="py-2 pr-3 font-medium">{t("Photo")}</th> : null}
            <th className="py-2 pr-3 font-medium">{t("Name")}</th>
            <th className="py-2 pr-3 font-medium">{t("Date of birth")}</th>
            <th className="py-2 pr-3 font-medium">{t("Gender")}</th>
            <th className="py-2 pr-3 font-medium">{t("Guardian")}</th>
            <th className="py-2 pr-3 font-medium">{t("Courses")}</th>
            <th className="py-2 font-medium">{t("Status")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const bad = row.errors.length > 0;
            const skipped = !bad && row.duplicate && !includeDuplicates;
            const photo = matches.byLine.get(row.line);
            const preview = photo?.fileName ? previews.get(photo.fileName) : undefined;
            return (
              <tr
                key={row.line}
                className={`border-b border-line align-top ${bad ? "bg-[var(--status-overdue-bg)]" : skipped ? "text-slate" : ""}`}
              >
                <td className="tabular py-2 pr-3 text-slate">{row.line}</td>
                {photosChosen ? (
                  <td className="py-2 pr-3">
                    {preview ? (
                      // Local preview of the chosen file, not yet uploaded.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={preview}
                        alt={`${t("Photo for")} ${row.fullName}`}
                        loading="lazy"
                        decoding="async"
                        className="size-10 rounded-full object-cover outline outline-1 -outline-offset-1 outline-black/10"
                      />
                    ) : (
                      <span className="text-slate">—</span>
                    )}
                  </td>
                ) : null}
                <td className="py-2 pr-3">{row.fullName || "—"}</td>
                <td className="tabular py-2 pr-3">{row.dateOfBirth ? formatDate(row.dateOfBirth) : "—"}</td>
                <td className="py-2 pr-3">
                  {row.gender === "female" ? t("Female") : row.gender === "male" ? t("Male") : "—"}
                </td>
                <td className="py-2 pr-3">
                  {[row.guardianName, row.guardianPhone].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="py-2 pr-3">{row.courseNames.join(", ") || "—"}</td>
                <td className="py-2">
                  {bad ? (
                    <ul className="flex flex-col gap-1 text-[var(--status-overdue-fg)]">
                      {row.errors.map((error) => (
                        <li key={error}>{t(error)}</li>
                      ))}
                    </ul>
                  ) : row.duplicate ? (
                    <span className="text-[var(--status-due-fg)]">
                      {includeDuplicates ? t("Looks already here, adding anyway") : t("Already here, skipped")}
                    </span>
                  ) : (
                    <span className="text-forest">{t("Ready")}</span>
                  )}
                  {!bad && photo?.problem ? (
                    <p className="mt-1 text-[var(--status-due-fg)]">{t(photo.problem)}</p>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
