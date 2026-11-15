-- TuitionDesk — when money is due on a course.
-- Run this in the Supabase SQL editor after 007_tuition_payments.sql.
-- tuition_due_day repeats each month. exam_due_on is a single date.

alter table public.courses
  add column if not exists tuition_due_day smallint,
  add column if not exists exam_due_on date;

alter table public.courses
  drop constraint if exists courses_tuition_due_day_check;

alter table public.courses
  add constraint courses_tuition_due_day_check
  check (tuition_due_day is null or tuition_due_day between 1 and 31);
