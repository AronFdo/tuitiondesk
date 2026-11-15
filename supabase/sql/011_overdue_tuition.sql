-- TuitionDesk — overdue tuition for the dashboard, worked out in the database
-- so the app never downloads every payment.
-- Run this in the Supabase SQL editor after 010_reminder_times.sql. Safe to re-run.
--
-- Tuition is paid in arrears: a month's fee is due on the due day of the
-- following month (October's fee is due on 1 November when the due day is
-- the 1st). Counts every month from the month a student joined a course,
-- once its due date has gone by. Each course uses its own due day, or the
-- institute's when it has none; courses with neither, or with no fee, are
-- left out. Each month owes the course fee less tuition recorded for that
-- month, and overpaying one month never offsets another.
-- Only active students on open enrollments in unarchived courses count.

create or replace function public.overdue_tuition_minor(
  p_today date default (now() at time zone 'Asia/Colombo')::date
)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  with institute as (
    select i.id, i.tuition_due_day
    from public.institutes i
    where i.id = public.current_institute_id()
      and public.current_role() = 'admin'
  ),
  months as (
    select
      e.student_id,
      e.course_id,
      c.monthly_fee_minor as fee,
      coalesce(c.tuition_due_day, institute.tuition_due_day) as due_day,
      month::date as period_month
    from public.enrollments e
    join institute on institute.id = e.institute_id
    join public.courses c
      on c.id = e.course_id
      and c.institute_id = e.institute_id
      and c.archived_at is null
    join public.students s
      on s.id = e.student_id
      and s.status = 'active'
    cross join lateral generate_series(
      date_trunc('month', e.start_date::timestamp),
      -- The current month is never due yet, so stop at last month.
      date_trunc('month', p_today::timestamp) - interval '1 month',
      interval '1 month'
    ) as month
    where e.end_date is null
      and c.monthly_fee_minor > 0
      and coalesce(c.tuition_due_day, institute.tuition_due_day) is not null
  ),
  due as (
    select
      months.*,
      -- Due in the following month. A 31st due day falls on the last day of
      -- shorter months.
      (months.period_month + interval '1 month')::date + least(
        months.due_day,
        extract(day from months.period_month + interval '2 months' - interval '1 day')::int
      ) - 1 as overdue_after
    from months
  ),
  paid as (
    select p.student_id, p.course_id, p.period_month, sum(p.amount_minor) as amount
    from public.tuition_payments p
    join institute on institute.id = p.institute_id
    where p.voided_at is null
    group by p.student_id, p.course_id, p.period_month
  )
  select coalesce(sum(greatest(due.fee - coalesce(paid.amount, 0), 0)), 0)::bigint
  from due
  left join paid
    on paid.student_id = due.student_id
    and paid.course_id = due.course_id
    and paid.period_month = due.period_month
  where p_today > due.overdue_after;
$$;

revoke all on function public.overdue_tuition_minor(date) from public, anon;
grant execute on function public.overdue_tuition_minor(date) to authenticated;
