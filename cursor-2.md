# Tuition Desk — Project Rules for Cursor

Read this file before generating or changing code. For anything visual (colours, type, components, copy), follow `design.md`.

## 1. What we're building

Tuition Desk is a multi-tenant SaaS for Sri Lankan tuition classes that prepare students for Cambridge English Qualifications (Young Learners, A2 Key, B1 Preliminary, B2 First, C1 Advanced, C2 Proficiency and similar). Students sit the exams through the British Council (BC). The tuition class collects class fees and exam fees from students, then registers and pays the BC in bulk for each exam session.

The product's job: keep students, courses, fees, exam registrations, and shared files in order, and make the bulk BC registration painless.

### Primary users
- **Admin (tutor / class owner):** sets everything up, records payments, registers students for exams. Mostly on a phone.
- **Teacher:** sees their courses and students, uploads files.
- **Parent / guardian:** the main portal user, since many students are children. One family account sees all their linked children (siblings are common). Read-only.
- **Student:** older students (teens, adults) can have their own login if the admin enables it. Same read-only portal as parents, limited to themselves.

## 2. MVP scope

Build these, in this order:

1. **Auth and institutes (tenants).** Sign up creates an institute and its first admin. Invite teachers and students by phone or email.
2. **Students.** Profile, guardian name and phone, current level, notes, status (active / archived).
3. **Courses.** Created by the admin. Nothing about courses is hardcoded: name, level (from the institute's own level list), teacher, schedule text, monthly fee, description. Students enrol in many courses.
4. **Course files.** Folders and files per course. Only enrolled students and assigned teachers can see them.
5. **Exam sessions.** Created by the admin: exam name, level, exam date, BC registration deadline, exam fee. Students from any course can be registered.
6. **Payments.** Manually recorded (cash, bank transfer, other). Linked to either a course month or an exam registration. Partial payments allowed. Every payment generates a receipt.
7. **BC remittance.** Per exam session: list of registered students, paid / unpaid status, total owed to BC, export to CSV and PDF, and a "mark as remitted" record (date, amount, reference).
8. **Reminders.** WhatsApp click-to-send links (`https://wa.me/<number>?text=<encoded>`) with pre-filled messages. No WhatsApp API.
9. **Invites.** Admin invites a parent or student from the student's page; the join link is sent by WhatsApp click-to-send (see §7a).
10. **Student and parent portal.** Read-only, mobile-first, installable PWA (see §7a).
11. **Our own billing.** Count active students per institute per month (see §6). Billing is invoiced manually for now; just compute and display the count.

### Out of scope for MVP
- WhatsApp Business API, SMS (including SMS one-time codes), email campaigns
- Online payment collection from students (PayHere later)
- Quizzes, grading, attendance, timetables
- Uploads or edits by students and parents
- Native mobile apps (the web app and PWA must be excellent on mobile instead)

## 3. Tech stack

- **Next.js** (App Router) + **TypeScript** (strict mode)
- **Tailwind CSS** + **shadcn/ui** components, themed per `design.md`
- **Supabase**: Postgres, Auth, Storage, Row Level Security
- **Zod** for all input validation (forms and server actions)
- **React Hook Form** for forms
- **date-fns** + **date-fns-tz** for dates
- **@react-pdf/renderer** for receipts and remittance PDFs
- **Lucide** icons
- Deploy on **Vercel**
- No separate Node/Express backend. Server Actions and route handlers are the backend.

### Production setup
- **Region:** Supabase project in Singapore (`ap-southeast-1`); Vercel functions pinned to Singapore (`sin1`). Closest to Sri Lanka.
- **Environments:** separate staging Supabase project; Vercel preview deployments point at staging. Never test against production data.
- **Migrations:** applied to staging and production via GitHub Actions (`supabase db push`), never by hand.
- **Backups:** Supabase daily backups on; add point-in-time recovery before onboarding paying institutes.
- **Errors:** Sentry (`@sentry/nextjs`) on client and server.
- **Analytics:** PostHog, no personal data in event properties (use IDs, not names or phones).
- **Email:** Resend as Supabase's custom SMTP for invites, magic links, password resets.
- **PWA:** web app manifest + icons for the portal; installable to home screen. No offline mode in MVP.
- **Background jobs (later):** Supabase cron or Inngest. Not a separate server.

Do not add new dependencies without a clear reason. Prefer what's already installed.

## 4. Data model

Every tenant-owned table has `institute_id uuid not null` and is protected by RLS. Every table has `id uuid primary key default gen_random_uuid()`, `created_at`, `updated_at`.

```
institutes        id, name, phone, address, logo_path, timezone default 'Asia/Colombo'
profiles          id (= auth.users.id), full_name, phone, email
memberships       institute_id, profile_id, role ('admin'|'teacher'|'student'|'parent')

levels            institute_id, name, sort_order, archived_at
                  -- admin-editable list, seeded with Cambridge levels, never an enum

students          institute_id, profile_id (nullable until they log in), full_name,
                  guardian_name, guardian_phone, phone, email, level_id, notes,
                  portal_enabled boolean default false,  -- student's own login
                  status ('active'|'archived'), archived_at
                  -- guardian_name/guardian_phone are contact details for reminders,
                  -- usable before any guardian has an account

guardian_links    institute_id, guardian_profile_id, student_id, relationship
                  ('mother'|'father'|'guardian'|'other'), unique(guardian_profile_id, student_id)
                  -- one guardian can link to many students (siblings), and a
                  -- guardian can belong to more than one institute

invites           institute_id, student_id, role ('parent'|'student'),
                  token_hash, expires_at, used_at, used_by_profile_id,
                  created_by, revoked_at

courses           institute_id, name, level_id, teacher_profile_id, schedule_text,
                  monthly_fee_minor, description, archived_at
enrollments       institute_id, course_id, student_id, start_date, end_date

folders           institute_id, course_id, parent_folder_id (nullable), name
files             institute_id, course_id, folder_id, storage_path, file_name,
                  mime_type, size_bytes, uploaded_by

exam_sessions     institute_id, exam_name, level_id, exam_date, registration_deadline,
                  fee_minor, notes, archived_at
exam_registrations institute_id, exam_session_id, student_id, fee_minor,
                  status ('registered'|'withdrawn'), candidate_number (nullable),
                  result_text (nullable)

charges           institute_id, student_id, kind ('course_month'|'exam'|'other'),
                  course_id (nullable), exam_registration_id (nullable),
                  period_month (date, first of month, nullable),
                  description, amount_minor, due_date, voided_at
payments          institute_id, student_id, amount_minor, method ('cash'|'bank'|'other'),
                  paid_at, reference, recorded_by, receipt_number, voided_at
payment_allocations institute_id, payment_id, charge_id, amount_minor

remittances       institute_id, exam_session_id, amount_minor, remitted_at,
                  reference, notes, recorded_by
activity_log      institute_id, actor_profile_id, action, entity, entity_id, data jsonb
```

### Rules
- **Money** is stored as integer minor units (`*_minor`, LKR cents). Never floats. Format with a single `formatLKR()` helper: `LKR 12,500.00`.
- **Balances are derived**, never stored: charge balance = amount − sum(allocations). Write SQL views for `student_balances` and `exam_session_payment_status`.
- **Never hard-delete** students, courses, exam sessions, charges, or payments. Archive or void instead. Payments are corrected by voiding and re-recording, never edited.
- **Receipt numbers** are sequential per institute (e.g. `TD-0001`), generated in a DB function to avoid race conditions.
- **Levels and course names come from data**, never from code constants. The only allowed constant is the seed list of default levels.
- **Phone numbers** are stored in E.164 (`+94771234567`). Accept local input (`0771234567`) and normalize.
- **Dates and times** are displayed in `Asia/Colombo`. Store timestamps as `timestamptz`.
- Log significant actions (payment recorded or voided, remittance marked, student archived) to `activity_log`.

## 5. Security and access

- RLS on every table. Policies check membership in `institute_id` and role.
- Admin: full access within their institute.
- Teacher: read students enrolled in their courses; read/write files in their courses; no payment data.
- Parent: read only the students linked to them via `guardian_links`, and for those students only: profile, enrollments, course files, exam registrations (date, candidate number, result), charges, payments, and receipts.
- Student: same as parent, limited to their own record, and only when `portal_enabled = true`.
- Parents and students never see other students in any form: no names, no counts, no enrollment lists. Course pages in the portal show files only.
- Portal users have no write access to any table except their own `profiles` row (name, password via Auth).
- Storage bucket `course-files` is private. Path format: `{institute_id}/{course_id}/{file_id}-{filename}`. Serve via short-lived signed URLs after checking enrolment.
- Upload limit 25 MB per file. Allow PDF, images, audio (mp3, m4a), Word, PowerPoint.
- Never trust `institute_id` from the client. Derive it from the session's active membership on the server.

## 6. Billing logic (our revenue)

An **active student** for a month = a student with `status = 'active'` and at least one enrollment overlapping that calendar month. Archived students and students with no current course are free. Expose this as a SQL function `active_student_count(institute_id, month)` and show it on the admin settings page. Pricing is configured outside the app for now.

## 7. WhatsApp reminders

- Build messages with a single helper: `buildWhatsAppLink(phone, message)`.
- Message templates live in `lib/messages.ts`, are polite and brief, and start with "Dear Parent," or the student's name.
- Example: `Dear Parent, a kind reminder that Kavindu's B2 First exam fee of LKR 38,000 is due by 15 November. Thank you, <Institute name>`.
- The "Unpaid" lists on exam sessions and courses show a send button per row that opens the link in a new tab.
- Invite template: `Dear Parent, here is your link to view Kavindu's classes, exams and fees on Tuition Desk: <link>. This link works once and expires in 7 days. <Institute name>`.

## 7a. Student and parent portal

### Invite and sign-in flow
1. Admin taps "Invite parent" (or "Invite student" if `portal_enabled`) on a student's page.
2. Server creates an `invites` row: random 32-byte token, store only its SHA-256 hash, expires in 7 days.
3. The app opens a WhatsApp click-to-send link to the guardian's (or student's) phone with the join URL `/join/<token>`.
4. `/join/<token>` validates the token, shows the institute name and child's name, and asks for full name and a password (min 8 chars). Phone number is pre-filled from the invite and not editable.
5. On submit (server action): create the auth user via the Supabase admin API with phone confirmed, or attach to the existing profile if this phone already has an account (a parent with children at two institutes, or a second child). Create `memberships` row (role parent/student), `guardian_links` row for parents, mark invite used.
6. Sign-in thereafter: phone + password. Email magic link as an option if the user adds an email.
7. "Forgot password": no SMS. Show "Ask your class to send a new link", and give admins a "Resend invite" button that issues a fresh token (revoking older unused ones).

Note for implementation: confirm Supabase phone + password sign-in works with no SMS provider configured when users are created server-side with phone confirmed. If it doesn't, ask before choosing an alternative.

### Portal screens (`app/(portal)/`)
- **Home:** per child: next exam with countdown, amount due, new files since last visit.
- **Courses → files:** enrolled courses, folders and files; audio plays inline, PDFs open in a new tab.
- **Exams:** registered sessions with exam name, date, candidate number when set, result when entered.
- **Payments:** charges with paid / due / overdue status, payment history, downloadable receipts (PDF).
- **Child switcher** in the header when a parent has more than one linked child.
- Track `last_seen_at` per portal user to compute "new files".

### Routing
- After sign-in, admins and teachers go to `(app)`; parents and students go to `(portal)`. A user with both kinds of membership gets a simple chooser.
- Portal routes never import admin components.

## 8. Code conventions

### Structure
```
app/
  (auth)/            sign-in, sign-up
  join/[token]/      invite acceptance
  (portal)/          parent and student portal (home, courses, exams, payments)
  (app)/             admin and teacher app shell
    dashboard/
    students/
    courses/[courseId]/files/
    exams/[sessionId]/
    payments/
    settings/
  api/               only when a route handler is truly needed
components/
  ui/                shadcn components (themed)
  <feature>/         feature components
lib/
  supabase/          server and browser clients
  validation/        zod schemas
  money.ts, phone.ts, dates.ts, messages.ts
supabase/
  migrations/        all schema changes as SQL migrations
  seed.sql
```

### Rules
- Server Components by default. Use `"use client"` only for interactivity.
- Mutations via **Server Actions**, each validating input with Zod and checking role on the server.
- Every server action returns `{ ok: true, data } | { ok: false, error }`. No throwing to the client.
- All schema changes go in `supabase/migrations`. Never change the DB by hand.
- Generate types with `supabase gen types typescript` and use them; no `any`.
- Name things by the domain: `ExamSession`, `Enrollment`, `Charge`, `Remittance`.
- Keep components small. If a file passes ~200 lines, split it.
- Every list screen has an empty state, a loading state, and an error state.
- Every form is usable on a 360px-wide phone.
- User-facing strings go through a simple `t()` helper so Sinhala and Tamil can be added later. English only for now.

### Testing
- Unit tests (Vitest) for `money.ts`, `phone.ts`, balance and active-student logic.
- Unit tests for invite token creation, hashing, expiry, and single use.
- Playwright happy path (admin): create course → add student → create exam session → register student → record payment → export remittance.
- Playwright happy path (portal): invite parent → accept invite → see child's course files, exam, and receipt.
- RLS tests: a parent cannot read a non-linked student, another institute's data, or any other student's name via any table.

## 9. Working with me (instructions for Cursor)

- Before a large change, outline the plan in a few lines and list the files you'll touch.
- Build one feature end to end (migration → RLS → server action → UI) before starting the next.
- Don't invent features outside §2. If something seems needed, ask.
- When a requirement is unclear, propose the simplest version that fits the data rules above.
- Don't reference Cambridge or British Council branding, logos, or colours anywhere in the UI.