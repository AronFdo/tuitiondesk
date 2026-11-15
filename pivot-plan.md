# TuitionDesk pivot: students, fees, exams and QR attendance

Status: Phase 1 (+ bulk student import) and Phase 2 (attendance) built 2026-11-10. Teachers can run attendance for the classes they teach. Exam features retired 2026-11-10 (migration 020; exam data kept in the database, unused): the app is students, attendance and tuition fees. Decided: receipts only (no invoices); attendance per class session. Builds on the existing app (Next.js 16 App Router, Supabase, numbered SQL in `supabase/sql/`). Next migration number is **029**.

## 1. What changes

| Area | Today | After the pivot |
|---|---|---|
| Navigation | Overview, Courses, Students, Payments | **Students, Attendance, Fees, Exams**, then Overview. Courses moves down (still needed: enrolments, monthly fee, exam sittings hang off it) |
| Student page `/students/[id]` | Admin-only exam candidate details + documents | Full profile: photo, QR card, attendance, fees, exams, documents |
| Attendance | Not built (listed as out of scope in `cursor-2.md`) | QR scan at the door/desk, per class session |
| Fees | Record and void payments on `/payments` | Same, plus numbered receipts printed on a thermal printer, and "scan a card to take a payment" |
| Exams | Sittings live on courses, entries per student | Own top-level Exams page listing sittings across courses; rest unchanged |

Update `cursor-2.md` §2 to move attendance into scope so the spec matches.

## 2. Data model (migrations 018–021)

### 018_student_identity.sql
```sql
alter table public.students
  add column student_code text,          -- human-readable, e.g. "TD-00042", printed under the QR
  add column qr_token text,              -- random, opaque, what the QR encodes
  add column qr_issued_at timestamptz,
  add column photo_path text;            -- in the student-photos bucket

-- per-institute counter so codes are sequential and never reused
create table public.institute_counters (
  institute_id uuid not null references public.institutes(id),
  name text not null,                    -- 'student_code', 'receipt'
  value bigint not null default 0,
  primary key (institute_id, name)
);
create function public.next_counter(p_institute uuid, p_name text) returns bigint ...;  -- update ... returning, security definer
create unique index on public.students (institute_id, student_code);
create unique index on public.students (qr_token);
```
- Backfill codes and tokens for existing students; set them in `create_student…` RPC for new ones.
- **QR payload:** `TD1:<qr_token>` (version prefix + random 32-hex-char token, see `lib/student-card.ts`). No names, phones or UUIDs in the QR. Re-issuing a lost card rotates `qr_token`; the old card stops working.
- **Photos:** new private bucket `student-photos`, path `<institute_id>/<student_id>/<uuid>.webp`, same folder-based RLS pattern as `student-documents` (013). Served via short-lived signed URLs. Keep the existing `photo` document kind for the BC exam photo; the profile photo is separate.

### 019_attendance.sql
```sql
create table public.class_sessions (       -- one sitting of a class, e.g. Grade 6 English on 12 Nov
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id),
  course_id uuid not null references public.courses(id),
  held_on date not null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opened_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, held_on)
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id),
  session_id uuid not null references public.class_sessions(id),
  student_id uuid not null references public.students(id),
  scanned_at timestamptz not null default now(),
  source text not null check (source in ('scanner', 'camera', 'manual')),
  recorded_by uuid references public.profiles(id),
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)            -- a double scan is a no-op, not a second row
);
```
- RPC `record_scan(p_session uuid, p_token text, p_source text, p_scanned_at timestamptz)` resolves the token, checks the institute, inserts `on conflict do nothing`, and returns `{status: 'marked' | 'already' | 'not_enrolled' | 'unknown_card' | 'archived', student, dues_summary}` in one round trip, so the scan screen responds fast.
- RLS: admins and the course's teacher can read/write; parents/students read their own rows (for the portal).
- Why sessions instead of loose scans: `schedule_text` is free text, so we cannot work out which class a scan belongs to from the time. Staff open a session for a class ("Start attendance"), and every scan lands on it. Absent = enrolled but no row.

### 020_receipts.sql
```sql
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id),
  receipt_no bigint not null,                -- from next_counter(institute, 'receipt')
  student_id uuid not null references public.students(id),
  tuition_payment_id uuid references public.tuition_payments(id),
  exam_payment_id uuid references public.exam_payments(id),
  total_minor integer not null,
  issued_at timestamptz not null default now(),
  issued_by uuid references public.profiles(id),
  print_count integer not null default 0,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institute_id, receipt_no),
  check (num_nonnulls(tuition_payment_id, exam_payment_id) = 1)
);
```
- Created inside `recordTuitionPayment` / `recordExamPayment` (move both into RPCs so payment + receipt are one transaction). Voiding a payment voids its receipt; reprints are counted and marked "COPY".
- Later: one receipt for several payments (a month + exam fee at one visit) via a `receipt_lines` table. Start with one payment per receipt.

### 021_hardware_settings.sql
`institute_settings` columns (or a JSON column on `institutes`): receipt paper width (58/80 mm), receipt footer text, print mode (`browser` | `escpos`), auto-print after payment (bool), scan sound on/off.

Regenerate `lib/supabase/database.types.ts` after each migration.

## 3. Student pages

`/students` — list gets photo thumbnails, student code, search by name/code/phone, and "Scan card" that jumps straight to a profile.

`/students/[studentId]` — rebuilt; visible to admins and teachers (teachers see only their courses' students, no fees):
- **Header:** photo (tap to retake), name, code, courses, status, guardian with WhatsApp link, QR.
- **Tabs (URL search param so links work):** Overview · Attendance · Fees · Exams · Documents.
  - Overview: attendance rate this month, next due, outstanding balance, upcoming exam.
  - Attendance: calendar/list per course, present/absent per session, manual mark/void.
  - Fees: dues by month (reuse `lib/dues.ts`), payments with receipt numbers, "Take payment", "Reprint receipt".
  - Exams: existing `CandidateForm` + entries (moved from today's page).
  - Documents: existing `DocumentList` + upload.
- **Photo capture:** `<input type="file" accept="image/*" capture="user">` so phones open the camera; resize and square-crop client-side to ~512 px WebP with a canvas before upload (no new dependency).
- **QR card:** `/students/[id]/card` print page, CR80 card size (85.6 × 54 mm) with photo, name, code, QR, institute logo. Also `/students/cards?course=…` to print a whole class on A4 sheets. "Reissue card" rotates the token with a confirm step.
- **QR generation:** add `qrcode` (small, no deps beyond itself) and render SVG on the server. Justification for the new dependency: generating QR correctly by hand is not worth it.

## 4. Attendance capture

### Scan screen `/attendance/scan`
Full-screen, designed for a laptop/tablet at the door:
1. Pick a class → "Start session" (creates `class_sessions` row; reopening the same day resumes it).
2. Big status panel: last scanned student's **photo**, name, ✓ marked / already marked / not in this class / unknown card, plus a red flag if fees are overdue. Photo lets the staff member catch someone using another student's card.
3. Running list of who has arrived, count present / enrolled, and "Mark manually" for forgotten cards.
4. "Close session" → absent list with WhatsApp click-to-send to guardians (reuses the existing `wa.me` pattern).

### External QR reader (how it connects)
Almost all USB and Bluetooth 2D scanners ship in **keyboard (HID) mode**: they "type" the QR contents followed by Enter. No driver, works in every browser including iPad/Android with a Bluetooth scanner. Plan:
- A `useScannerInput` hook listens to `keydown` on the page (no visible input that needs focus), buffers characters, and treats a burst ending in Enter with inter-key gaps under ~30 ms as a scan. This keeps normal typing in search boxes from being read as a scan.
- Only accept payloads that `parseCardPayload` (`lib/student-card.ts`) accepts; anything else shows "Not a TuitionDesk card".
- Debounce the same token within 3 s; the DB unique constraint is the real guard.
- Optional later: **Web Serial** mode for scanners set to USB-CDC/serial (Chrome/Edge desktop only), for setups where keyboard focus is unreliable.
- Configure the scanner: keyboard layout = US, suffix = Enter, no prefix. Put a "Test scanner" box in Settings › Devices that shows exactly what the scanner sends.

### Camera fallback
On a phone with no scanner: use the browser `BarcodeDetector` API where available (Chrome/Android), fall back to a small library (`@zxing/browser` or `qr-scanner`) for iOS Safari. Same `record_scan` call with `source = 'camera'`.

### Flaky internet
Queue scans in IndexedDB with their real `scanned_at` when offline, show them as "pending", and flush when back online. The scan screen must never lose a scan. (Can ship in phase 2 if needed.)

## 5. Fees and thermal receipts

### Flow
`Fees` page (today's `/payments`) and the student's Fees tab both use one "Take payment" dialog: choose months/exam fee → amount → record → receipt created → print. On the desk, **scan the card → student's fees open** so payment takes seconds.

### Printing to a thermal printer — two modes
**Mode A: browser print (ship first).** A receipt route `/receipts/[id]/print` renders plain HTML sized for the roll (`@page { size: 80mm auto; margin: 0 }`, 58 mm variant), monospace-ish layout, logo in black and white, then calls `window.print()`. Works with any thermal printer that has an OS driver (Xprinter, Epson TM-T20/T82, etc.), on Windows, macOS and Android. To skip the print dialog on the desk machine, run Chrome with `--kiosk-printing` and set the thermal printer as default. Downside: no cash-drawer kick, driver margins vary.

**Mode B: direct ESC/POS (phase 3, optional).** Send raw ESC/POS bytes from the browser:
- USB printers via **WebUSB**, serial/Bluetooth-SPP printers via **Web Serial**. Chrome/Edge desktop and Android Chrome only (not Safari/iOS).
- Silent printing, exact layout, paper cut, cash-drawer kick, and QR on the receipt.
- Caveats: on Windows the vendor driver often claims the USB device so WebUSB cannot open it (needs WinUSB via Zadig); macOS is usually fine. Network (LAN) printers on port 9100 are not reachable from a browser at all and would need a small local print bridge (e.g. QZ Tray, which is paid for commercial use, or our own tiny agent). Avoid unless a client insists.
- Build a small `lib/escpos.ts` encoder (text, bold, align, feed, cut, QR) rather than a big dependency, with unit tests on the byte output.

**Receipt content:** institute name/logo/phone, receipt no., date/time, student name + code, item lines (e.g. "Grade 6 English – Nov 2026", "B1 Preliminary exam fee"), total, paid by, balance still due, footer text, "COPY" on reprints.

Note: what's printed is a **receipt** for money received. If you also want **invoices** (bills before payment, e.g. a monthly statement handed to the student), that is a separate document from dues; flagged in open questions.

## 6. Exams

- New `/exams` page: sittings across courses (date, deadline, entries, paid/unpaid, total owed to BC), reusing `lib/exams.ts`, `lib/registrations.ts` and the BC export routes.
- Course pages keep the per-course sitting editor.
- Student page Exams tab replaces today's candidate page.

## 7. Settings › Devices
- Scanner test box (shows raw input and whether it parsed as a card).
- Printer: paper width, mode (browser / ESC/POS), "Connect printer" (WebUSB/Web Serial pairing, remembered by the browser), "Print test receipt", auto-print toggle.
- These are per-device choices, so store pairing in the browser and defaults on the institute.

## 8. Portal (parents/students)
- Attendance tab for each child (present/absent per session this month).
- Receipts list with receipt numbers.
- Show the child's QR card so a parent can display it on a phone if the card is forgotten (rotating token makes this safe to revoke).

## 9. Delivery phases

| Phase | Scope | Rough size |
|---|---|---|
| **1. Identity** ✅ | 018 migration, CSV bulk import, student codes/tokens, photo upload + bucket, rebuilt student page with tabs, QR + printable card | 1–1.5 weeks |
| **2. Attendance** ✅ | 019, scan screen, HID scanner hook, camera fallback, session close + absent WhatsApp, attendance tab, offline queue | 1.5–2 weeks |
| **3. Receipts** ✅ | 020, payment+receipt RPCs, browser thermal print, scan-to-pay, reprint/void | 1 week |
| **4. Nav + Exams** (exams dropped; nav and dashboard done with the retirement) ✅ | Nav reorder, `/exams` page, dashboard reworked around today's attendance and dues | 0.5–1 week |
| **5. Devices + ESC/POS** | 021, Settings › Devices, WebUSB/Web Serial ESC/POS, cash drawer | 1 week, optional |
| **6. Portal** | Attendance and receipts in family portal, QR on parent's phone | 0.5 week |

Each phase: migration + RLS → `lib/` loader → server action/RPC → UI → vitest for pure logic (scanner burst detection, token parsing, ESC/POS encoder, receipt totals, attendance rate). Read the relevant guide in `node_modules/next/dist/docs/` before writing route handlers and print pages (Next 16 differs from older versions). Add new paths (`/attendance`, `/fees`, `/exams`, `/receipts`) to `appPaths` in `proxy.ts`.

## 10. Risks
- **Card sharing / proxy attendance:** mitigated by showing the photo on every scan.
- **Browser hardware APIs are Chromium-only:** keep Mode A and HID scanning as the baseline that works everywhere.
- **Receipt numbering gaps:** counter increments inside the same transaction as the payment, so a failed payment does not burn a number.
- **Photos are personal data of minors:** private bucket, signed URLs only, delete on student deletion, mention in privacy text.

## 11. Open questions
1. Which scanner and printer models (or at least: USB vs Bluetooth vs LAN printer, 58 vs 80 mm paper)?
2. ~~Invoices?~~ Receipts only.
3. ~~Per session or per day?~~ Per class session.
4. ~~Can teachers run the scan screen?~~ Yes, for their own classes (change in `can_run_course` if not wanted).
5. Should parents get an automatic notification on arrival/absence (WhatsApp click-to-send only today, no API)?
6. Does Courses stay in the main nav, or move under Settings?
