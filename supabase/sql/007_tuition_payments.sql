-- TuitionDesk — tuition payments belong to a course. Exam payments belong to
-- an exam entry, so they come with the entries in 013_exam_registrations.sql.
-- Run this in the Supabase SQL editor after 006_restore_owner.sql.
-- Safe to re-run: tables are created only if missing; policies are replaced.

create table if not exists public.tuition_payments (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete restrict,
  course_id uuid not null references public.courses (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  amount_minor integer not null check (amount_minor > 0),
  paid_on date not null,
  period_month date not null,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (extract(day from period_month) = 1)
);

drop trigger if exists tuition_payments_set_updated_at on public.tuition_payments;
create trigger tuition_payments_set_updated_at
before update on public.tuition_payments
for each row execute function public.set_updated_at();

-- Definer checks so a payment policy never reads courses or students under
-- row level security.
create or replace function public.course_in_current_institute(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.courses course
    where course.id = p_course_id
      and course.institute_id = public.current_institute_id()
      and course.archived_at is null
  );
$$;

create or replace function public.student_on_course(p_student_id uuid, p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.enrollments enrollment
    where enrollment.student_id = p_student_id
      and enrollment.course_id = p_course_id
      and enrollment.institute_id = public.current_institute_id()
      and enrollment.end_date is null
  );
$$;

revoke all on function public.course_in_current_institute(uuid) from public, anon;
revoke all on function public.student_on_course(uuid, uuid) from public, anon;
grant execute on function public.course_in_current_institute(uuid) to authenticated;
grant execute on function public.student_on_course(uuid, uuid) to authenticated;

alter table public.tuition_payments enable row level security;

grant select, insert, update on public.tuition_payments to authenticated, service_role;

revoke all on public.tuition_payments from anon;

drop policy if exists tuition_payments_select on public.tuition_payments;
create policy tuition_payments_select on public.tuition_payments
for select to authenticated
using (
  institute_id = public.current_institute_id()
  and public.current_role() = 'admin'
);

drop policy if exists tuition_payments_insert_admin on public.tuition_payments;
create policy tuition_payments_insert_admin on public.tuition_payments
for insert to authenticated
with check (
  institute_id = public.current_institute_id()
  and public.current_role() = 'admin'
  and public.course_in_current_institute(course_id)
  and public.student_on_course(student_id, course_id)
);

drop policy if exists tuition_payments_update_admin on public.tuition_payments;
create policy tuition_payments_update_admin on public.tuition_payments
for update to authenticated
using (
  institute_id = public.current_institute_id()
  and public.current_role() = 'admin'
)
with check (
  institute_id = public.current_institute_id()
  and public.current_role() = 'admin'
);
