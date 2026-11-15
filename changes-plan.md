# TuitionDesk change set: notifications, course history, staff, change log, RBAC

Status: planned 2026-11-15. S1 built 2026-11-15 (024_permissions.sql). S2 built 2026-11-16 (025_student_history.sql). S3 built 2026-11-16 (026_student_courses.sql, 027_course_history.sql). S4 built 2026-11-16 (028_staff.sql). Builds on `pivot-plan.md` (numbered SQL in `supabase/sql/`). Next migration number is **029**.

## Requested changes

1. Admin is notified in the platform when a student has been on a course for 9 months, to start exam registration prep.
2. Guardian is notified when attendance is marked, and when a student leaves the institute.
3. Fee reminders and payment-received notifications to guardians.
4. Track every course a student has been enrolled in as they progress.
5. Teacher/staff details page (CRUD).
6. Change log on student details, visible to admin only. *(RBAC)*
7. Only admin can view fee information. *(RBAC)*

**Channel decision:** guardian messages go by **SMS first** through a Sri Lankan gateway. The WhatsApp Cloud API is a later adapter on the same outbox, with SMS as the fallback when a WhatsApp send fails. This changes the MVP scope line in `development-plan.md` ("Out of scope: … SMS"); update it when S6 starts.

## What already exists

| Area | Today |
|---|---|
| Course history | `enrollments` has `start_date` / `end_date`; removing a student from a course sets `end_date` (`lib/actions/courses.ts`). There is no history UI and no "move to next course" action. |
| Change log | `activity_log` (actor, action, entity, `data jsonb`) exists with admin-only RLS. App code writes to it by hand and inconsistently; imports and RPCs skip it. |
| Fees admin-only | Only admins and parents can read `tuition_payments` and `receipts` (RLS); `lib/payments.ts` / `lib/receipts.ts` check for admin. Gaps: teachers can read `courses.monthly_fee_minor`, and role checks are scattered `role === "admin"` comparisons. |
| Messaging | Click-to-send only (`buildWhatsAppLink` in `lib/messages.ts`). Nothing sends automatically and there is no scheduler. |
| Leaving | `students.status` is `active | archived`. No leave date or reason. |

## Segments (in build order)

S1–S4 don't depend on each other's outcomes and can ship one at a time. S6 needs S5.

### S1: Permissions, and fees locked to admin

- `lib/permissions.ts`: one table of rules, `can(role, permission)`, e.g. `fees.view`, `fees.record`, `students.history`, `staff.manage`. Matching SQL helper `public.has_permission(text)` used by RLS and RPCs.
- Replace the scattered `role === "admin"` checks in `lib/`, `lib/actions/`, `app/(app)/` with `can()`.
- Hide fee data from non-admins:
  - stop teachers reading `courses.monthly_fee_minor` (column grant or a view);
  - gate the `overdue_tuition_minor` function;
  - hide dashboard fee tiles, the Fees nav item, and the fee sections of the student profile and course page.
- **Tests:** a teacher session gets nothing back from any fee table, function, or page.

### S2: Student change log

- Migration 024: a trigger on `students` (plus `enrollments`, `guardian_links`) writes a field-by-field diff `{ field: [old, new] }` to `activity_log`, with `actor_profile_id = auth.uid()`. This captures RPC and import changes too. Photo and document changes are logged as events, not diffs.
- Drop the hand-written `activity_log` inserts that the trigger now covers.
- UI: a "History" tab on `/students/[id]`, gated by `students.history` (admin only). Shows who changed what and when, in Colombo time.

### S3: Course progression and students leaving

- `enrollments.outcome`: `completed | promoted | withdrawn | left` (null while open).
- ~~RPC `move_student_to_course`~~ Done 2026-11-16 as `set_student_courses` (026): the student edit page has course checkboxes; unticked courses end today and newly ticked ones start today, in one transaction. Still to add: `outcome` on the ended enrolment.
- "Course history" section on the student profile: every enrolment with dates, duration, and outcome.
- Leaving the institute: `students.left_on`, `students.leave_reason`; a `mark_student_left` RPC closes all open enrolments with outcome `left` and emits a `student.left` event (sent in S5/S6).

### S4: Staff directory (CRUD)

- `staff_members` table: name, phone (E.164), NIC, address, role/title, subjects, `joined_on`, `left_on`, `archived_at`, optional `profile_id`. Staff who never log in are allowed (same pattern as students).
- `/staff` list, add / edit / archive, "Invite to log in" (reuses the existing email invite and links `profile_id` on accept), assign courses.
- Admin only, via `staff.manage`. Archive rather than delete.

### S5: Notifications core + 9-month alert

- `notifications`: in-app alerts for staff (bell in the app shell, unread count, dismiss).
- `message_outbox`: guardian messages, with `channel`, `to_phone`, `template`, `body`, `status` (`queued | sent | delivered | failed`), `attempts`, `provider_ref`, `error`. Every send is recorded and can be retried.
- Events that enqueue messages: attendance marked, student left, payment recorded (with receipt number), fee due soon / overdue.
- 9-month alert: a daily job finds open enrolments where `start_date + 9 months <= today` with no alert yet, and creates one admin notification per enrolment ("Start exam registration prep"). A unique key stops duplicates.
- Scheduler: Vercel Cron calling a route handler protected by a secret. This is the first cron in the app.

### S6: SMS delivery

- Delivery interface `sendMessage(outboxRow)` with adapters:
  - **SMS gateway** (first, automatic);
  - **wa.me click-to-send** (manual fallback, "pending messages" queue for the front desk);
  - **WhatsApp Cloud API** (later).
- Delivery-status callback route that updates `message_outbox`.
- Templates (keep short: 160 chars English, about 70 per part in Sinhala/Tamil):
  - attendance: "{student} marked present at {course}, {time}."
  - left: "{student}'s enrolment at {institute} has ended as of {date}."
  - fee reminder: "{student}'s {month} fee of {amount} is due on {date}."
  - payment received: "Received {amount} for {student}, receipt {no}. {link}"
- Guardian opt-in/out flag, quiet hours (queue and send in the morning), and an option to send attendance as one daily summary instead of per scan.
- Fee reminders run off the existing due days (`lib/due-days.ts`): N days before the due date and once overdue.
- Gateway setup: register a sender ID (institute or "TuitionDesk"), top up credit, store the API key in env. Compare Notify.lk, Text.lk, and Dialog / Mobitel bulk SMS on price and delivery reports.

## Open decisions

1. **SMS gateway:** which provider (compare current prices and delivery reports).
2. **Attendance messages:** one per scan, or a daily summary per student? Per scan is what was asked for, but it's the main cost driver.
3. **The 9-month clock:** from each course's enrolment date, or from when the student first joined the institute (continuing across course moves)?
4. **Access levels:** are admin and teacher enough, or add a third role (e.g. front desk) with its own permissions? S1's permission table supports either.
