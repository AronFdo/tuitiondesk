-- Class-wide due days for tuition fees and exam fees.
-- Reminders can use these later. Re-run this if the earlier time columns were added.
-- Run this in the Supabase SQL editor. Safe to re-run.

alter table public.institutes
  drop column if exists tuition_due_time,
  drop column if exists exam_due_time;

alter table public.institutes
  add column if not exists tuition_due_day smallint,
  add column if not exists exam_due_day smallint;

alter table public.institutes
  drop constraint if exists institutes_tuition_due_day_check;
alter table public.institutes
  add constraint institutes_tuition_due_day_check
  check (tuition_due_day is null or tuition_due_day between 1 and 31);

alter table public.institutes
  drop constraint if exists institutes_exam_due_day_check;
alter table public.institutes
  add constraint institutes_exam_due_day_check
  check (exam_due_day is null or exam_due_day between 1 and 31);
