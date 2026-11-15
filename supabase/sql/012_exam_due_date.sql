-- TuitionDesk — the class-wide exam fee is due on one date, not every month.
-- Run this in the Supabase SQL editor after 011_overdue_tuition.sql. Safe to re-run.
-- The old day of the month cannot become a date, so it is dropped; set the
-- date again in Settings.

alter table public.institutes
  add column if not exists exam_due_on date;

alter table public.institutes
  drop constraint if exists institutes_exam_due_day_check;

alter table public.institutes
  drop column if exists exam_due_day;
  
