-- TuitionDesk — change a student's courses from the edit page.
-- Takes the full list of courses the student should be on and, in one
-- transaction, ends the open enrolments that are no longer in it and starts
-- the new ones. Ended enrolments are kept, so past courses stay on record
-- (025 logs each start and end in the student's history). Courses that are
-- archived are not on the edit page, so their enrolments are left alone.
-- Run this in the Supabase SQL editor after 025_student_history.sql. Safe to re-run.

create or replace function public.set_student_courses(
  p_student_id uuid,
  p_course_ids uuid[],
  p_on date default (now() at time zone 'Asia/Colombo')::date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  institute uuid := public.current_institute_id();
  wanted uuid[] := coalesce(p_course_ids, '{}');
  course uuid;
begin
  if not public.has_permission('students.manage') then
    raise exception 'not allowed';
  end if;
  if not exists (
    select 1 from public.students s
    where s.id = p_student_id and s.institute_id = institute and s.status = 'active'
  ) then
    raise exception 'student not found';
  end if;
  if exists (
    select 1 from unnest(wanted) as w (id)
    where not exists (
      select 1 from public.courses c
      where c.id = w.id and c.institute_id = institute and c.archived_at is null
    )
  ) then
    raise exception 'course not found';
  end if;

  -- An enrolment that starts after p_on ends on its start date, since an
  -- enrolment cannot end before it starts.
  update public.enrollments e
  set end_date = greatest(e.start_date, p_on)
  from public.courses c
  where e.student_id = p_student_id
    and e.institute_id = institute
    and e.end_date is null
    and c.id = e.course_id
    and c.archived_at is null
    and not (e.course_id = any (wanted));

  foreach course in array wanted loop
    insert into public.enrollments (institute_id, course_id, student_id, start_date)
    values (institute, course, p_student_id, p_on)
    on conflict (course_id, student_id) where end_date is null do nothing;
  end loop;
end;
$$;

revoke all on function public.set_student_courses(uuid, uuid[], date) from public, anon;
grant execute on function public.set_student_courses(uuid, uuid[], date) to authenticated;
