# Tuition Desk — phased development plan

Build the MVP in `cursor-2.md`, in the order given there. Visual work follows `design-3.md`. The product name in UI, copy, emails, and metadata is **TuitionDesk**. The repo is greenfield: each phase lands one feature from migration through RLS, server action, and UI before the next phase starts.

Out of scope for the MVP: WhatsApp Business API, SMS (including one-time codes), email campaigns, online collection (PayHere), quizzes, grading, attendance, timetables, uploads or edits by students and parents, offline mode, and native apps.

## How every phase is built

1. Migration in `supabase/migrations` (schema, RLS, views, functions). Applied to staging and production with GitHub Actions (`supabase db push`), never by hand.
2. Regenerate types with `supabase gen types typescript`. No `any`.
3. Zod schemas in `lib/validation`. Server actions return `{ ok: true, data } | { ok: false, error }` and check role on the server. `institute_id` comes from the session’s active membership, never from the client.
4. UI in the App Router. Server Components by default. Forms use React Hook Form and work at 360px. Lists have empty, loading, and error states. User-facing copy goes through `t()`.
5. Money is integer minor units. Phones are stored E.164. Timestamps are `timestamptz`, displayed in `Asia/Colombo`. Students, courses, exam sessions, charges, and payments are archived or voided, never hard-deleted.
6. No separate Node server. Server Actions and route handlers are the backend. Portal routes never import admin components.

A phase is done when the role it is for can finish its flow on a phone, RLS blocks everyone else, and the phase’s tests pass.

## Decisions locked for the MVP

These are the readings of `cursor-2.md` where a builder still has to choose a shape. Change them before the phase that depends on them.

| Topic | Plan |
|---|---|
| Teacher invites | Email, through Supabase Auth with Resend as custom SMTP. Teachers use `(app)`. |
| Parent and student invites | Item 9 and §7a, not a second email invite. Token join link, sent with WhatsApp click-to-send. |
| Phone + password | First task of the invites phase: confirm Supabase phone + password works with no SMS provider when the user is created server-side with the phone confirmed. If it does not, stop and ask before picking another sign-in. |
| Several institutes | The session stores one active institute. A switcher appears only when the user has more than one membership of the same kind. A user who is both staff and a portal user gets a chooser after sign-in. |
| Monthly course fees | An admin action, “Create this month’s fees”, writes one `course_month` charge per enrolment that overlaps that month. No cron. |
| Students before a login | The student row exists with `profile_id` null and `portal_enabled` false. Guardian name and phone are reminder contacts and work before any guardian has an account. |
| Guardian link | `guardian_links`, as in the data model. One guardian, many students; a guardian may belong to more than one institute. |
| New files | `memberships.last_seen_at`, updated when a portal user opens the portal, so “new since last visit” is per person per institute. |
| Receipt | PDF via `@react-pdf/renderer`. The admin preview can share that PDF. Footer: “Made with TuitionDesk” and the single-colour wordmark. |
| Our pricing | `active_student_count` is computed and shown. Prices stay outside the app. |
| Analytics | PostHog event properties carry IDs only. No names, phones, or emails. |

## Phase 0 — Foundation

Stand up the app shell, shared rules, and the staging path so later phases only add domain behaviour.

**Deliver**

- Next.js (App Router), TypeScript strict, Tailwind v4, shadcn/ui, Zod, React Hook Form, date-fns and date-fns-tz, Lucide, `@react-pdf/renderer`.
- Theme from `design-3.md` §13 in `app/globals.css`. Plus Jakarta Sans and Inter via `next/font/google`. Noto Sans Sinhala and Noto Sans Tamil available for later, English strings only. Wordmark SVGs in `public/brand/`, not typeset in the app.
- `lib/money.ts` (`formatLKR`), `lib/phone.ts` (local `077…` and `+94…` → E.164), `lib/dates.ts` (Colombo display, `12 Dec 2026`), `lib/messages.ts` (stub), `t()`.
- Supabase clients in `lib/supabase`. Local Supabase. Empty `supabase/migrations` and `seed.sql`.
- Platform baseline: Supabase in Singapore (`ap-southeast-1`), Vercel functions in `sin1`, a separate staging project, Vercel preview deployments pointed at staging. GitHub Action runs `supabase db push`. Sentry (`@sentry/nextjs`) on client and server. PostHog installed with the ID-only rule above. Daily backups noted; point-in-time recovery is a launch check, not this phase.
- Admin chrome only, matching `design-3.md` §6: `forest` header, mint asterisk icon, bottom nav (Home, Students, Exams, Pay, More) under 768px, 240px `forest` sidebar from 1024px. Placeholder routes under `(app)`. No domain data. Sign-in page may use the mint gradient; the working app does not.
- Vitest for money formatting and phone normalisation.

**Done when** the admin shell renders at 360px and 1024px with `paper`, one `forest` primary, and a visible focus ring, and the helper tests pass.

## Phase 1 — Auth and institutes

Sign-up creates an institute and its first admin. Teachers join by email.

**Schema**

- `institutes`, `profiles`, `memberships` (`admin | teacher | student | parent`), `activity_log`.
- `updated_at` trigger and an RLS helper that reads the active membership.
- Admin: full access in their institute. A teacher can read their own profile and membership. Parent and student policies arrive with the portal.

**App**

- `(auth)`: sign up, sign in. Staff sign-in is email and password. Password reset goes through Resend.
- Sign-up writes institute, profile (`id = auth.users.id`), and admin membership in one transaction.
- Settings: institute name, phone, address, logo, timezone (default `Asia/Colombo`). Logo in a private bucket.
- Invite a teacher by email. Accepting the invite creates their membership and lands them in `(app)`.

**Done when** a new admin can sign up, sign in, edit the institute, invite a teacher by email, and that teacher can accept and open the shell. A second institute’s data is invisible.

## Phase 2 — Levels and students

**Schema**

- `levels`: admin-editable, `sort_order`, `archived_at`. Seed the default Cambridge level names in `seed.sql` only. No level enum in code.
- `students`: guardian name and phone, own phone and email, `level_id`, notes, `portal_enabled` default false, `status` active or archived, nullable `profile_id`.

**App**

- Settings: add, rename, reorder, archive levels.
- Students list: search, filter by level, row list, empty state. “Add student”. Course filter arrives in Phase 3.
- Student detail header: name, level, guardian phone. Tabs for Courses, Payments, and Exams render empty until later phases. Portal access is Phase 9.
- Archive and restore. Archiving writes `activity_log`.

**Done when** an admin can add a student with a local guardian number, see it stored as E.164, filter the list, and archive them. A teacher with no course yet sees no students.

## Phase 3 — Courses and enrolments

**Schema**

- `courses`: name, `level_id`, `teacher_profile_id`, `schedule_text`, `monthly_fee_minor`, description, `archived_at`.
- `enrollments`: student, course, `start_date`, `end_date`. A student may enrol in many courses.

**App**

- Admin creates and archives courses. Nothing about a course is a code constant.
- Course detail, Students tab: enrol and end an enrolment.
- Student detail, Courses tab: current and past enrolments.
- Students list can filter by course.
- Teacher reads students enrolled in their courses, with no payment fields.

**Done when** an admin can create a course, assign a teacher, enrol two students, and that teacher sees only those students.

## Phase 4 — Course files

**Schema**

- `folders` (nested via `parent_folder_id`) and `files`.
- Private `course-files` bucket. Path `{institute_id}/{course_id}/{file_id}-{filename}`.

**App**

- Course detail, Files tab. Folders first, then files, alphabetical. Empty state for past papers and worksheets.
- Upload limited to 25 MB and to PDF, images, audio (mp3, m4a), Word, and PowerPoint. Admin and the assigned teacher upload and organise.
- Download via a short-lived signed URL after a teacher-assignment or admin check. The same helper will later require enrolment for portal users.

**Done when** a teacher can upload a PDF into a folder and open it, and a teacher of another course gets no URL.

## Phase 5 — Exam sessions

**Schema**

- `exam_sessions`: exam name, level, exam date, registration deadline, `fee_minor`, notes, `archived_at`.
- `exam_registrations`: student (from any course), `fee_minor` copied at registration, `registered` or `withdrawn`, nullable candidate number and result text.

**App**

- Admin creates a session and registers or withdraws students. Withdrawing does not delete the row.
- Session screen: date, deadline, registered count. Filters All / Unpaid / Paid show everyone as unpaid until Phase 6.
- Student detail, Exams tab, for the admin. The portal exam list is Phase 10.

**Done when** an admin can register students from two different courses onto one session and withdraw one without losing the row.

## Phase 6 — Payments and receipts

**Schema**

- `charges`: `course_month`, `exam`, or `other`. Course charges store `course_id` and `period_month` (first of month). Exam charges store `exam_registration_id`. `voided_at` instead of delete.
- `payments`: amount, `cash | bank | other`, `paid_at`, reference, `recorded_by`, `receipt_number`, `voided_at`.
- `payment_allocations`. Balance is never stored.
- View `student_balances`: charge balance = amount − sum of allocations.
- SQL function for the next receipt number per institute (`TD-0001`), safe under concurrency.
- “Create this month’s fees” inserts one charge per overlapping enrolment and skips months that already have a charge for that enrolment.
- Registering for an exam inserts the exam charge. Withdrawing voids the unpaid charge.

**App**

- Record payment: pick student, tick outstanding charges, enter amount (partial allowed), method, save. Money input with an LKR prefix.
- Void a payment and its allocations, then record a new one. Payments are never edited in place. Both actions write `activity_log`.
- Receipt PDF and receipt preview with “Share receipt”. Student detail, Payments tab. Payments list for the admin.
- Teachers never read charges or payments.

**Done when** a partial payment reduces the derived balance, a second payment clears it, voiding restores the balance, and two receipts in a row get sequential numbers. Vitest covers the balance rules.

## Phase 7 — BC remittance

**Schema**

- `remittances`: records per session (date, amount, reference, notes, `recorded_by`). Marking one writes `activity_log`.
- View `exam_session_payment_status`: per registration, paid / part paid / unpaid from allocations, plus session totals owed.

**App**

- Session summary: registered, paid, total owed.
- Row filters All, Unpaid, Paid. Status badges use the design-system pairs, Paid with a check icon. Sent to BC uses the violet pair, never green.
- Export CSV and PDF of registered students and payment status.
- “Mark as sent to BC” stores the remittance. No Cambridge or British Council name, logo, or colour in the UI.

**Done when** the export matches the on-screen list and totals, and the session shows the remittance after it is marked.

## Phase 8 — Reminders and the deadline strip

**App**

- `buildWhatsAppLink(phone, message)` and templates in `lib/messages.ts`, including the fee reminder and the invite template from §7.
- Each unpaid row on a course and on an exam session has “Send reminder”, opening `https://wa.me/…` in a new tab. Guardian phone is the default number.
- Deadline strip on every admin screen when a session’s registration deadline is within 14 days. Amber bar, nearest session, unpaid count, link to that unpaid list. Within 3 days the border and count go red. Several close sessions show the nearest plus “and N more”. The portal does not show this strip.

**Done when** an unpaid exam fee produces a pre-filled WhatsApp link to the guardian, and a deadline inside 14 days appears under the header on Home, Students, Exams, and Payments.

## Phase 9 — Invites

Admin invites a parent, or a student whose portal is enabled, from the student page. The join link goes out through the WhatsApp helper from Phase 8.

**Spike first.** Confirm phone + password sign-in with no SMS provider, as in §7a. Stop and ask if it fails.

**Schema**

- `guardian_links`: `guardian_profile_id`, `student_id`, `relationship` (`mother | father | guardian | other`), unique on guardian and student.
- `invites`: `student_id`, role `parent | student`, `token_hash` (SHA-256 of a random 32-byte token), `expires_at` (7 days), `used_at`, `used_by_profile_id`, `created_by`, `revoked_at`.
- Vitest for token creation, hashing, expiry, and single use.

**App**

- Student detail, Portal access: linked guardians, “Invite parent” / “Resend invite”, status Not invited / Invited / Joined, and the student’s own-login toggle (`portal_enabled`). “Invite student” shows only when that toggle is on.
- Server action creates the invite. The app opens a WhatsApp click-to-send to the guardian’s or student’s phone with `/join/<token>` and the §7 template.
- `app/join/[token]`: validate the token, show the institute and the child’s name, ask for full name and a password (minimum 8 characters). Phone is pre-filled and not editable. Expired or used link: ask the class to send a new one.
- On submit: create the auth user with the Supabase admin API and the phone confirmed, or attach the existing profile when that phone already has an account (a second child, or a second institute). Write the membership, and for a parent the `guardian_links` row. For a student invite, set `students.profile_id`. Mark the invite used.
- “Resend invite” issues a new token and revokes older unused invites for that student and role.
- Sign-in after joining is phone + password. If the user later adds an email, email magic link is available. Forgot password does not send SMS: the screen says to ask the class for a new link.

**Done when** an admin can invite a parent, the parent can open the link once, set a password, and sign in with that phone. A second use of the same token fails. Resend invalidates the previous unused link.

## Phase 10 — Student and parent portal

Read-only, mobile-first, installable. Routes live in `app/(portal)/` and do not import admin components.

**Schema and access**

- Parent: read only students linked in `guardian_links`, and for those students only profile, enrolments, course files, exam registrations (date, candidate number, result), charges, payments, and receipts.
- Student: the same, limited to their own row, and only when `portal_enabled` is true.
- No names, counts, or enrolment lists of other students. Course pages show files only.
- Portal users write nothing except their own `profiles` row (name). Password changes go through Auth.
- `memberships.last_seen_at` drives “new files”.
- Storage signed URLs for portal users require an enrolment in that course, or a guardian link to an enrolled student.

**App**

- After sign-in, admins and teachers go to `(app)`. Parents and students go to `(portal)`. Someone with both kinds of membership gets a chooser.
- Portal chrome from `design-3.md` §6: institute logo and name, child switcher only when a parent has two or more linked children, bottom nav on every width (Home, Courses, Exams, Fees), single column, max-width 640px. TuitionDesk appears in the footer and on sign-in, not in the header.
- Home, per child: next exam with countdown, amount due, up to three new files.
- Courses → folders and files. Audio plays inline. PDFs open in a new tab.
- Exams: name, date, candidate number when set, result when entered.
- Fees: charges with paid / due / overdue, payment history, downloadable receipt PDFs. Portal words are “Fees” and the child’s name, not “Charges” or “Allocations”.
- PWA: web app manifest and icons from `design-3.md` §12 (`theme_color` `#00472A`). Installable to the home screen. No offline cache. Dismissible add-to-home-screen banner after the second visit.

**Done when** a parent with two children can switch between them, open a course file, see the exam and a receipt, and cannot read another family’s student by id, list, or count. A student login sees only themselves, and only after `portal_enabled` is on.

## Phase 11 — Dashboard and our billing

**Schema**

- `active_student_count(institute_id, month)`: `status = active` and at least one enrolment overlapping that calendar month. Archived students and students with no current course count as zero.

**App**

- Dashboard: greeting, deadline strip, three figures (active students, unpaid this month, next exam), and a “Needs attention” list (overdue charges and upcoming deadlines).
- Settings shows this month’s active-student count for manual invoicing. No in-app price and no payment to us.

**Done when** archiving a student or ending their only enrolment drops the count for that month, and the dashboard figures match the lists. Vitest covers the count rules.

## Phase 12 — MVP verification

One pass across the finished app, not new product scope.

- Playwright (admin): create course → add student → create exam session → register student → record payment → export remittance.
- Playwright (portal): invite parent → accept invite → see the child’s course file, exam, and receipt.
- RLS: a parent cannot read a student they are not linked to, another institute’s data, or any other student’s name through any table. A teacher cannot read payments. A student with `portal_enabled` false cannot open the portal.
- Activity log contains payment recorded, payment voided, remittance marked, and student archived.
- Walk every list at 360px: empty, loaded, and error. Portal included.
- Launch checks: staging receives migrations from GitHub Actions, preview deployments use staging, Sentry receives a test error, PostHog properties have no names or phones, daily backups are on, and point-in-time recovery is enabled before any paying institute.

**Done when** both Playwright paths are green and the RLS checks above hold.

## Suggested build order

| Phase | Feature | Depends on |
|---|---|---|
| 0 | Foundation, shell, staging path | — |
| 1 | Auth, institutes, teacher email invites | 0 |
| 2 | Levels and students | 1 |
| 3 | Courses and enrolments | 2 |
| 4 | Course files | 3 |
| 5 | Exam sessions | 2 |
| 6 | Payments and receipts | 3 and 5 |
| 7 | BC remittance | 6 |
| 8 | Reminders and deadline strip | 6 and 7 |
| 9 | Parent and student invites | 2 and 8 |
| 10 | Portal and PWA | 4, 5, 6, and 9 |
| 11 | Dashboard and billing count | 3 and 6 |
| 12 | Verification | 0–11 |

Phases 4 and 5 can swap. Payments stay after both. Invites stay after reminders, because the join link is a WhatsApp click-to-send. The portal stays after files, exams, payments, and invites.

## After the MVP

Do not start these during the phases above.

- Sinhala and Tamil strings through the existing `t()` helper.
- PayHere for student payments.
- WhatsApp Business API, SMS, or email campaigns.
- Offline support.
- Supabase cron or Inngest for background work.
- Dark mode, using the CSS variables already in place.
