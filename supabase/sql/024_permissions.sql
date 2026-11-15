-- TuitionDesk — role permissions, and fee data for admins only.
-- One table of which role may do what, read by public.has_permission() in
-- policies and functions. It mirrors ROLE_PERMISSIONS in lib/permissions.ts;
-- tests/permissions.test.ts fails when the two drift apart.
--
-- Course fees (monthly fee, due day, and the retired exam fees) are no longer
-- readable straight from public.courses by signed-in users. Staff with
-- fees.view, and a parent for their own child's courses, read them through
-- public.course_fees(). Writes are unchanged: admins still insert and update
-- those columns.
-- Run this in the Supabase SQL editor after 023_student_details.sql. Safe to re-run.

create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from (
      values
        -- permissions:begin
        ('admin', 'fees.view'),
        ('admin', 'fees.record'),
        ('admin', 'students.manage'),
        ('admin', 'students.documents'),
        ('admin', 'students.history'),
        ('admin', 'courses.manage'),
        ('admin', 'courses.all'),
        ('admin', 'institute.manage'),
        ('admin', 'staff.manage'),
        ('admin', 'parents.invite'),
        ('admin', 'notices.class')
        -- permissions:end
    ) as granted (role, permission)
    where granted.role = public.current_role()
      and granted.permission = p_permission
  );
$$;

revoke all on function public.has_permission(text) from public, anon;
grant execute on function public.has_permission(text) to authenticated;

-- Every course column except the fee ones stays readable.
revoke select on public.courses from authenticated;
grant select (
  id,
  institute_id,
  name,
  board,
  level,
  format,
  exam_date,
  registration_opens_on,
  registration_closes_on,
  late_closes_on,
  speaking_from,
  speaking_to,
  venue,
  catalogue_session_id,
  teacher_profile_id,
  schedule_text,
  exam_due_on,
  description,
  archived_at,
  created_at,
  updated_at
) on public.courses to authenticated;

-- Fees for the given courses in the current institute: all of them with
-- fees.view, otherwise only courses a parent's child is on.
create or replace function public.course_fees(p_course_ids uuid[])
returns table (course_id uuid, monthly_fee_minor integer, tuition_due_day smallint)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.monthly_fee_minor, c.tuition_due_day
  from public.courses c
  where c.id = any (p_course_ids)
    and c.institute_id = public.current_institute_id()
    and (
      public.has_permission('fees.view')
      or (
        public.current_role() = 'parent'
        and public.parent_can_read_course(c.id)
      )
    );
$$;

revoke all on function public.course_fees(uuid[]) from public, anon;
grant execute on function public.course_fees(uuid[]) to authenticated;

-- Same sum as 011, now run as owner because callers can no longer read the
-- fee columns. The institute row gates it to fees.view, and every other table
-- is joined through it, so it still sees only the caller's institute.
create or replace function public.overdue_tuition_minor(
  p_today date default (now() at time zone 'Asia/Colombo')::date
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  with institute as (
    select i.id, i.tuition_due_day
    from public.institutes i
    where i.id = public.current_institute_id()
      and public.has_permission('fees.view')
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

-- Money records follow fees.view instead of the admin role directly.
drop policy if exists tuition_payments_select on public.tuition_payments;
create policy tuition_payments_select on public.tuition_payments
for select to authenticated
using (
  institute_id = public.current_institute_id()
  and (
    public.has_permission('fees.view')
    or (
      public.current_role() = 'parent'
      and voided_at is null
      and public.parent_has_student(student_id)
    )
  )
);

drop policy if exists receipts_select_admin on public.receipts;
create policy receipts_select_admin on public.receipts
for select to authenticated
using (
  institute_id = public.current_institute_id()
  and public.has_permission('fees.view')
);
