-- TuitionDesk — course history and students leaving the institute.
--
-- * enrollments.outcome records why a course ended: completed, promoted
--   (moved up to the next course), withdrawn (stopped), or left (left the
--   institute). Null while the course is open, and for courses ended before
--   this file ran.
-- * A student who leaves gets status 'left' with left_on, leave_reason and
--   leave_note. Unlike 'archived' (removed by mistake or a duplicate), a
--   student who left stays on record and can rejoin. Every open course ends
--   on the leaving date with outcome 'left'.
-- * set_student_courses (026) takes an outcome for each course it ends.
-- * The change log (025) names leaving and rejoining, and records outcomes.
-- Run this in the Supabase SQL editor after 026_student_courses.sql. Safe to re-run.

alter table public.enrollments
  add column if not exists outcome text;

alter table public.enrollments drop constraint if exists enrollments_outcome_check;
alter table public.enrollments add constraint enrollments_outcome_check check (
  outcome is null
  or (outcome in ('completed', 'promoted', 'withdrawn', 'left') and end_date is not null)
);

alter table public.students
  add column if not exists left_on date,
  add column if not exists leave_reason text,
  add column if not exists leave_note text;

alter table public.students drop constraint if exists students_status_check;
alter table public.students add constraint students_status_check
  check (status in ('active', 'left', 'archived'));

alter table public.students drop constraint if exists students_leave_check;
alter table public.students add constraint students_leave_check check (
  (status = 'left') = (left_on is not null)
  and (leave_reason is null or leave_reason in (
    'completed', 'moved_away', 'other_institute', 'cost', 'personal', 'other'
  ))
  and (leave_note is null or char_length(leave_note) <= 500)
);

-- Leaving fields are shown as their own event, not as field changes.
create or replace function public.student_diff(p_old jsonb, p_new jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(
    jsonb_object_agg(field.key, jsonb_build_array(p_old -> field.key, field.value)),
    '{}'::jsonb
  )
  from jsonb_each(p_new) as field
  where field.key not in (
      'id', 'institute_id', 'created_at', 'updated_at', 'archived_at',
      'qr_token', 'qr_issued_at', 'photo_path', 'student_code',
      'first_name', 'last_name', 'left_on', 'leave_reason', 'leave_note'
    )
    and (p_old -> field.key) is distinct from field.value;
$$;

create or replace function public.log_student_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changes jsonb;
  action text;
  data jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.activity_log (institute_id, actor_profile_id, action, entity, entity_id, data, created_at)
    values (
      new.institute_id, auth.uid(), 'student_created', 'students', new.id,
      jsonb_build_object('actor_name', public.actor_name(), 'full_name', new.full_name),
      clock_timestamp()
    );
    return new;
  end if;

  changes := public.student_diff(to_jsonb(old), to_jsonb(new));
  action := case
    when old.status <> 'archived' and new.status = 'archived' then 'student_archived'
    when old.status = 'archived' and new.status <> 'archived' then 'student_restored'
    when old.status <> 'left' and new.status = 'left' then 'student_left'
    when old.status = 'left' and new.status = 'active' then 'student_rejoined'
    else 'student_updated'
  end;
  if action = 'student_updated' and (changes - 'status') = '{}'::jsonb then
    return new;
  end if;

  data := jsonb_build_object('actor_name', public.actor_name(), 'changes', changes - 'status');
  if action = 'student_left' then
    data := data || jsonb_strip_nulls(jsonb_build_object(
      'left_on', new.left_on,
      'leave_reason', new.leave_reason,
      'leave_note', new.leave_note
    ));
  end if;

  insert into public.activity_log (institute_id, actor_profile_id, action, entity, entity_id, data, created_at)
  values (new.institute_id, auth.uid(), action, 'students', new.id, data, clock_timestamp());
  return new;
end;
$$;

revoke all on function public.log_student_change() from public, anon, authenticated;

create or replace function public.log_enrollment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  course_name text;
  action text;
  changes jsonb;
begin
  select c.name into course_name from public.courses c where c.id = new.course_id;

  if tg_op = 'INSERT' then
    action := 'enrollment_started';
  elsif old.end_date is null and new.end_date is not null then
    action := 'enrollment_ended';
  elsif old.end_date is not null and new.end_date is null then
    action := 'enrollment_reopened';
  else
    action := 'enrollment_updated';
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(
      jsonb_object_agg(field.key, jsonb_build_array(to_jsonb(old) -> field.key, field.value)),
      '{}'::jsonb
    )
    into changes
    from jsonb_each(to_jsonb(new)) as field
    where field.key in ('start_date', 'end_date', 'course_id', 'outcome')
      and (to_jsonb(old) -> field.key) is distinct from field.value;
    if changes = '{}'::jsonb then
      return new;
    end if;
  end if;

  insert into public.activity_log (institute_id, actor_profile_id, action, entity, entity_id, data, created_at)
  values (
    new.institute_id, auth.uid(), action, 'students', new.student_id,
    jsonb_strip_nulls(jsonb_build_object(
      'actor_name', public.actor_name(),
      'enrollment_id', new.id,
      'course_id', new.course_id,
      'course_name', course_name,
      'start_date', new.start_date,
      'end_date', new.end_date,
      'outcome', new.outcome,
      'changes', changes
    )),
    clock_timestamp()
  );
  return new;
end;
$$;

revoke all on function public.log_enrollment_change() from public, anon, authenticated;

-- 026's version had no outcomes; drop it so the call is never ambiguous.
drop function if exists public.set_student_courses(uuid, uuid[], date);

-- p_outcomes maps a course id to why that course is ending, for the courses
-- being unticked; a course left out of it ends with no outcome.
create or replace function public.set_student_courses(
  p_student_id uuid,
  p_course_ids uuid[],
  p_on date default (now() at time zone 'Asia/Colombo')::date,
  p_outcomes jsonb default '{}'::jsonb
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
  if exists (
    select 1 from jsonb_each_text(coalesce(p_outcomes, '{}'::jsonb)) as o
    where o.value not in ('completed', 'promoted', 'withdrawn')
  ) then
    raise exception 'bad outcome';
  end if;

  update public.enrollments e
  set end_date = greatest(e.start_date, p_on),
      outcome = p_outcomes ->> e.course_id::text
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

revoke all on function public.set_student_courses(uuid, uuid[], date, jsonb) from public, anon;
grant execute on function public.set_student_courses(uuid, uuid[], date, jsonb) to authenticated;

-- The student leaves on p_left_on: every open course ends then, with outcome
-- 'left'. The leaving date cannot be in the future.
create or replace function public.mark_student_left(
  p_student_id uuid,
  p_left_on date,
  p_reason text default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  institute uuid := public.current_institute_id();
begin
  if not public.has_permission('students.manage') then
    raise exception 'not allowed';
  end if;
  if p_left_on is null or p_left_on > (now() at time zone 'Asia/Colombo')::date then
    raise exception 'bad leaving date';
  end if;

  update public.enrollments
  set end_date = greatest(start_date, p_left_on),
      outcome = 'left'
  where student_id = p_student_id
    and institute_id = institute
    and end_date is null;

  update public.students
  set status = 'left',
      left_on = p_left_on,
      leave_reason = nullif(btrim(p_reason), ''),
      leave_note = nullif(btrim(p_note), '')
  where id = p_student_id
    and institute_id = institute
    and status = 'active';
  if not found then
    raise exception 'student not found';
  end if;
end;
$$;

revoke all on function public.mark_student_left(uuid, date, text, text) from public, anon;
grant execute on function public.mark_student_left(uuid, date, text, text) to authenticated;

-- Back on the books. Courses are added again from the edit page; the old ones
-- stay in their history.
create or replace function public.rejoin_student(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('students.manage') then
    raise exception 'not allowed';
  end if;
  update public.students
  set status = 'active', left_on = null, leave_reason = null, leave_note = null
  where id = p_student_id
    and institute_id = public.current_institute_id()
    and status = 'left';
  if not found then
    raise exception 'student not found';
  end if;
end;
$$;

revoke all on function public.rejoin_student(uuid) from public, anon;
grant execute on function public.rejoin_student(uuid) to authenticated;
