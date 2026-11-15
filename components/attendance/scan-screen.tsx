"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CameraScanner } from "@/components/attendance/camera-scanner";
import { playScanSound } from "@/components/attendance/sounds";
import { useLocalValue } from "@/components/attendance/use-local-value";
import { useScanner } from "@/components/attendance/use-scanner";
import { initials, StudentAvatar } from "@/components/students/student-avatar";
import { ConfirmDialog } from "@/components/ui/form-dialog";
import { closeSession, recordScan, setAttendance, type ScanOutcome } from "@/lib/actions/attendance";
import type { RosterStudent, SessionMark, SessionPage } from "@/lib/attendance";
import { formatDate, formatTime } from "@/lib/dates";
import { addToQueue, queueKey, readQueue, writeQueue, type QueuedScan } from "@/lib/scan-queue";
import { parseCardPayload } from "@/lib/student-card";
import { t } from "@/lib/t";

type LastScan =
  | { kind: "idle" }
  | {
      kind: ScanOutcome["status"] | "not_card" | "offline" | "error";
      student: { fullName: string; code: string | null; photoUrl: string | null; feesOverdue: boolean } | null;
      at: string;
      message?: string;
      // Changes on every scan so the panel flashes even for the same student.
      id: number;
    };

const REPEAT_MS = { scanner: 3000, camera: 5000 };

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function ScanScreen({ page }: { page: SessionPage }) {
  const router = useRouter();
  const sessionId = page.session.id;
  const roster = useMemo(() => new Map(page.roster.map((student) => [student.id, student])), [page.roster]);
  const [marks, setMarks] = useState(() => new Map(page.marks.map((mark) => [mark.studentId, mark])));
  const [last, setLast] = useState<LastScan>({ kind: "idle" });
  const [queueText] = useLocalValue(queueKey(sessionId));
  const queue = useMemo(() => (queueText ? readQueue({ getItem: () => queueText }, sessionId) : []), [queueText, sessionId]);
  const [mutedText, setMutedText] = useLocalValue("td-scan-muted");
  const muted = mutedText === "1";
  const [camera, setCamera] = useState(false);
  const [focused, setFocused] = useState(true);
  const [filter, setFilter] = useState("");
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closePending, setClosePending] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const recent = useRef(new Map<string, number>());
  const scanCount = useRef(0);
  const flushing = useRef(false);
  const frame = useRef<HTMLDivElement>(null);

  // Keyboard scanners type into the focused window only.
  useEffect(() => {
    const update = () => setFocused(document.hasFocus());
    update();
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);
    return () => {
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
    };
  }, []);

  const sound = useCallback(
    (kind: "ok" | "repeat" | "problem") => {
      if (!muted) {
        playScanSound(kind);
      }
    },
    [muted],
  );

  const show = useCallback(
    (kind: Exclude<LastScan["kind"], "idle">, student: RosterStudent | { fullName: string; code: string | null } | null, message?: string) => {
      scanCount.current += 1;
      setLast({
        kind,
        student: student
          ? {
              fullName: student.fullName,
              code: student.code,
              photoUrl: "photoUrl" in student ? student.photoUrl : null,
              feesOverdue: "feesOverdue" in student ? student.feesOverdue : false,
            }
          : null,
        at: new Date().toISOString(),
        message,
        id: scanCount.current,
      });
    },
    [],
  );

  const applyOutcome = useCallback(
    (outcome: ScanOutcome, scannedAt: string, source: SessionMark["source"], quiet = false) => {
      const student = outcome.studentId ? roster.get(outcome.studentId) : undefined;
      if ((outcome.status === "marked" || outcome.status === "already") && outcome.studentId) {
        const studentId = outcome.studentId;
        setMarks((current) => {
          if (current.has(studentId)) {
            return current;
          }
          const next = new Map(current);
          next.set(studentId, { studentId, scannedAt, source });
          return next;
        });
      }
      if (quiet) {
        return;
      }
      show(
        outcome.status,
        student ?? (outcome.fullName ? { fullName: outcome.fullName, code: outcome.code } : null),
      );
      sound(outcome.status === "marked" ? "ok" : outcome.status === "already" ? "repeat" : "problem");
    },
    [roster, show, sound],
  );

  // Writing fires the storage event useLocalValue listens to, so the banner
  // updates by itself.
  const saveQueue = useCallback(
    (next: QueuedScan[]) => {
      writeQueue(storage(), sessionId, next);
      window.dispatchEvent(new CustomEvent("td-local-value", { detail: queueKey(sessionId) }));
    },
    [sessionId],
  );

  const handleScan = useCallback(
    async (text: string, source: "scanner" | "camera") => {
      setFilter("");
      const token = parseCardPayload(text);
      if (!token) {
        show("not_card", null);
        sound("problem");
        return;
      }
      const now = Date.now();
      const seen = recent.current.get(token);
      if (seen && now - seen < REPEAT_MS[source]) {
        return;
      }
      recent.current.set(token, now);
      const scannedAt = new Date(now).toISOString();

      let result: Awaited<ReturnType<typeof recordScan>>;
      try {
        result = await recordScan({ sessionId, scanned: text, source, scannedAt });
      } catch {
        // No connection: keep the scan on this device and send it later.
        saveQueue(addToQueue(readQueue(storage(), sessionId), { token: text, scannedAt, source }));
        show("offline", null);
        sound("repeat");
        return;
      }
      if (!result.ok) {
        show("error", null, result.error);
        sound("problem");
        return;
      }
      applyOutcome(result.data, scannedAt, source);
    },
    [applyOutcome, saveQueue, sessionId, show, sound],
  );

  const flush = useCallback(async () => {
    if (flushing.current) {
      return;
    }
    const pending = readQueue(storage(), sessionId);
    if (pending.length === 0) {
      return;
    }
    flushing.current = true;
    let remaining = pending;
    for (const scan of pending) {
      try {
        const result = await recordScan({ sessionId, scanned: scan.token, source: scan.source, scannedAt: scan.scannedAt });
        if (result.ok) {
          applyOutcome(result.data, scan.scannedAt, scan.source, true);
        }
      } catch {
        break;
      }
      remaining = remaining.filter((item) => item !== scan);
      saveQueue(remaining);
    }
    flushing.current = false;
  }, [applyOutcome, saveQueue, sessionId]);

  useEffect(() => {
    if (queue.length === 0) {
      return;
    }
    const retry = () => void flush();
    window.addEventListener("online", retry);
    const timer = setInterval(retry, 15_000);
    retry();
    return () => {
      window.removeEventListener("online", retry);
      clearInterval(timer);
    };
  }, [flush, queue.length]);

  useScanner(
    useCallback((text: string) => void handleScan(text, "scanner"), [handleScan]),
    page.session.open,
  );

  async function mark(student: RosterStudent, present: boolean) {
    setRowError(null);
    const previous = marks.get(student.id);
    setMarks((current) => {
      const next = new Map(current);
      if (present) {
        next.set(student.id, { studentId: student.id, scannedAt: new Date().toISOString(), source: "manual" });
      } else {
        next.delete(student.id);
      }
      return next;
    });
    const result = await setAttendance({ sessionId, studentId: student.id, present }).catch(() => null);
    if (!result?.ok) {
      setRowError(result?.error ?? t("No connection. That change was not saved. Try again when you are back online."));
      setMarks((current) => {
        const next = new Map(current);
        if (previous) {
          next.set(student.id, previous);
        } else {
          next.delete(student.id);
        }
        return next;
      });
    }
  }

  async function confirmClose() {
    setClosePending(true);
    setCloseError(null);
    const result = await closeSession({ sessionId }).catch(() => null);
    setClosePending(false);
    if (!result?.ok) {
      setCloseError(result?.error ?? t("No connection. Try again."));
      return;
    }
    setClosing(false);
    setCamera(false);
    router.refresh();
  }

  function toggleMuted() {
    setMutedText(muted ? null : "1");
  }

  function fullScreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void frame.current?.requestFullscreen?.().catch(() => undefined);
    }
  }

  const present = page.roster.filter((student) => marks.has(student.id));
  const absent = page.roster.filter((student) => !marks.has(student.id));
  const words = filter.trim().toLowerCase();
  const matches = (student: RosterStudent) =>
    !words || `${student.fullName} ${student.code}`.toLowerCase().includes(words);

  return (
    <div ref={frame} className="flex flex-col gap-6 bg-paper [&:fullscreen]:overflow-y-auto [&:fullscreen]:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words">{page.course.name}</h1>
          <p className="text-slate">
            {formatDate(page.session.heldOn)}
            {" · "}
            <span className="tabular font-medium text-ink">{present.length}</span>
            {` / ${page.roster.length} ${t("here")}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={toolClassName} onClick={() => setCamera((value) => !value)}>
            {camera ? t("Stop camera") : t("Use camera")}
          </button>
          <button type="button" className={toolClassName} onClick={toggleMuted} aria-pressed={muted}>
            {muted ? t("Sound off") : t("Sound on")}
          </button>
          <button type="button" className={`${toolClassName} hidden md:inline-flex`} onClick={fullScreen}>
            {t("Full screen")}
          </button>
          <button
            type="button"
            className="press inline-flex h-11 items-center justify-center rounded-lg bg-forest px-4 text-sm font-medium text-white"
            onClick={() => {
              setCloseError(null);
              setClosing(true);
            }}
          >
            {t("Finish")}
          </button>
        </div>
      </div>

      <div className={`grid gap-4 ${camera ? "md:grid-cols-[minmax(0,1fr)_320px]" : ""}`}>
        <ScanPanel last={last} focused={focused} />
        {/* Always in the page, so each scan's result is read out reliably. */}
        <p role="status" className="sr-only">
          {scanAnnouncement(last)}
        </p>
        {camera ? <CameraScanner onScan={(text) => void handleScan(text, "camera")} /> : null}
      </div>

      {queue.length > 0 ? (
        <p className="rounded-lg bg-[var(--status-due-bg)] px-4 py-3 text-sm text-ink">
          {queue.length === 1
            ? t("1 scan is waiting for the internet. It will be sent automatically.")
            : `${queue.length} ${t("scans are waiting for the internet. They will be sent automatically.")}`}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={t("Find a student to mark by hand")}
          aria-label={t("Find a student")}
          className="h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-base text-ink focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest md:max-w-sm"
        />
        {rowError ? <p role="alert" className="text-sm text-destructive">{rowError}</p> : null}
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <h2>{`${t("Not here yet")} (${absent.length})`}</h2>
          {absent.length === 0 ? (
            <p className="mt-2 text-slate">{page.roster.length === 0 ? t("No students on this course yet.") : t("Everyone is here.")}</p>
          ) : (
            <ul className="mt-2">
              {absent.filter(matches).map((student) => (
                <li key={student.id} className="flex min-h-16 items-center gap-3 border-b border-line py-2">
                  <StudentAvatar name={student.fullName} photoUrl={student.photoUrl} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-ink">{student.fullName}</span>
                    <span className="tabular text-sm text-slate">{student.code}</span>
                  </span>
                  <button
                    type="button"
                    className="h-11 shrink-0 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-forest"
                    aria-label={`${t("Mark here")}, ${student.fullName}`}
                    onClick={() => void mark(student, true)}
                  >
                    {t("Mark here")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2>{`${t("Here")} (${present.length})`}</h2>
          {present.length === 0 ? (
            <p className="mt-2 text-slate">{t("Scanned students show here.")}</p>
          ) : (
            <ul className="mt-2">
              {present
                .filter(matches)
                .sort((a, b) => (marks.get(b.id)?.scannedAt ?? "").localeCompare(marks.get(a.id)?.scannedAt ?? ""))
                .map((student) => {
                  const markRow = marks.get(student.id);
                  return (
                    <li key={student.id} className="flex min-h-16 items-center gap-3 border-b border-line py-2">
                      <StudentAvatar name={student.fullName} photoUrl={student.photoUrl} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-ink">{student.fullName}</span>
                        <span className="text-sm text-slate">
                          {markRow ? `${formatTime(markRow.scannedAt)} · ${sourceLabel(markRow.source)}` : ""}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="h-11 shrink-0 px-2 text-sm text-slate"
                        aria-label={`${t("Undo")}, ${student.fullName}`}
                        onClick={() => void mark(student, false)}
                      >
                        {t("Undo")}
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={closing}
        title={t("Finish attendance?")}
        body={
          absent.length === 0
            ? t("Everyone is marked here.")
            : `${absent.length} ${absent.length === 1 ? t("student is") : t("students are")} ${t("marked absent. You can open it again later today if someone comes late.")}`
        }
        pending={closePending}
        error={closeError}
        tone="primary"
        confirmLabel={t("Finish")}
        pendingLabel={t("Finishing…")}
        onOpenChange={(open) => {
          if (!open && !closePending) {
            setClosing(false);
          }
        }}
        onConfirm={() => void confirmClose()}
      />
    </div>
  );
}

const toolClassName =
  "press inline-flex h-11 items-center justify-center rounded-lg border border-line bg-surface px-4 text-sm font-medium text-forest";

function sourceLabel(source: SessionMark["source"]) {
  return source === "manual" ? t("by hand") : source === "camera" ? t("camera") : t("card");
}

const PANEL: Record<Exclude<LastScan["kind"], "idle">, { title: string; tone: "ok" | "info" | "warn" | "bad" }> = {
  marked: { title: "Here", tone: "ok" },
  already: { title: "Already marked", tone: "info" },
  not_enrolled: { title: "Not in this class", tone: "warn" },
  archived: { title: "This student has left the class", tone: "bad" },
  unknown_card: { title: "Card not recognised", tone: "bad" },
  not_card: { title: "Not a TuitionDesk card", tone: "bad" },
  closed: { title: "Attendance is finished for this class", tone: "warn" },
  offline: { title: "Saved on this device", tone: "warn" },
  error: { title: "Not saved", tone: "bad" },
};

const TONE_CLASS = {
  ok: "border-forest bg-mint-soft",
  info: "border-line bg-surface",
  warn: "border-amber bg-[var(--status-due-bg)]",
  bad: "border-[var(--status-overdue-fg)] bg-[var(--status-overdue-bg)]",
};

function ScanPanel({ last, focused }: { last: LastScan; focused: boolean }) {
  if (last.kind === "idle") {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-surface p-6 text-center">
        <p className="text-xl font-semibold text-forest">{t("Ready to scan")}</p>
        <p className="max-w-sm text-slate">
          {focused
            ? t("Scan a student card with the QR reader, or turn on the camera.")
            : t("Click anywhere on this page first. The QR reader types into the window you last clicked.")}
        </p>
      </div>
    );
  }

  const panel = PANEL[last.kind];
  const detail = scanDetail(last);

  return (
    <div
      key={last.id}
      className={`flex min-h-56 items-center gap-5 rounded-2xl border-2 p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 ${TONE_CLASS[panel.tone]}`}
    >
      {last.student?.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={last.student.photoUrl} alt="" className="size-32 shrink-0 rounded-2xl object-cover outline outline-1 -outline-offset-1 outline-black/10 md:size-40" />
      ) : last.student ? (
        <span className="flex size-32 shrink-0 items-center justify-center rounded-2xl bg-surface text-4xl font-semibold text-forest md:size-40">
          {initials(last.student.fullName)}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm font-medium uppercase tracking-wide text-slate">{t(panel.title)}</p>
        {last.student ? (
          <p className="break-words text-2xl font-semibold leading-tight text-ink md:text-3xl">{last.student.fullName}</p>
        ) : null}
        {last.student?.code ? <p className="tabular text-slate">{last.student.code}</p> : null}
        {detail ? <p className="text-ink">{detail}</p> : null}
        {last.student?.feesOverdue ? (
          <p className="mt-1 inline-flex w-fit rounded-md bg-[var(--status-overdue-bg)] px-2 py-1 text-sm font-medium text-[var(--status-overdue-fg)]">
            {t("Tuition overdue")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function scanDetail(last: Exclude<LastScan, { kind: "idle" }>) {
  return last.kind === "marked"
    ? `${t("Marked at")} ${formatTime(last.at)}`
    : last.kind === "unknown_card"
      ? t("This card may have been replaced by a new one. Check the student's page.")
      : last.kind === "not_enrolled"
        ? t("Add them to this course first, or check they are in the right room.")
        : last.kind === "offline"
          ? t("No internet. The scan will be sent when the connection is back.")
          : last.kind === "error"
            ? (last.message ?? "")
            : "";
}

function scanAnnouncement(last: LastScan) {
  if (last.kind === "idle") {
    return "";
  }
  return [
    t(PANEL[last.kind].title),
    last.student?.fullName,
    scanDetail(last),
    last.student?.feesOverdue ? t("Tuition overdue") : "",
  ]
    .filter(Boolean)
    .join(". ");
}
