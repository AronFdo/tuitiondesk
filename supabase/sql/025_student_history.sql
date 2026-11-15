-- TuitionDesk — a change log for every student, written by the database.
-- Triggers on students and enrollments add a row to activity_log for every
-- create, edit, archive, course start and course end, whoever made it: the
-- app, an RPC, a bulk import, or someone in the SQL editor. Edits store each
-- changed field as { "field": [old, new] }.
--
-- Every row about a student has entity 'students' and entity_id = the
-- student, so the History tab reads one student with one filter. The actor's
-- name is copied in when the row is written, so history still names staff
-- who later leave.
--
-- Rows use clock_timestamp() so a student and their courses, saved in one
-- transaction, still list in the order they happened.
--
-- The log is append-only: signed-in users can no longer update or delete it,
-- staff can add rows only as themselves, and reading it needs
-- students.history.
-- Run this in the Supabase SQL editor after 024_permissions.sql. Safe to re-run.

alter table public.activity_log
  alter column actor_profile_id set default auth.uid();

create index if not exists activity_log_entity
on public.activity_log (institute_id, entity, entity_id, created_at desc);

-- Fields left out of a diff: keys and timestamps, the card token and photo
-- (logged as their own events by the app), archived_at (status covers it),
-- and first/last name (full_name is built from them and shows the change).
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
      'first_name', 'last_name'
    )
    and (p_old -> field.key) is distinct from field.value;
$$;

create or replace function public.actor_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(btrim(p.full_name), ''), p.email)
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.actor_name() from public, anon, authenticated;

create or replace function public.log_student_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changes jsonb;
  action text;
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
  if changes = '{}'::jsonb then
    return new;
  end if;

  action := case
    when old.status <> 'archived' and new.status = 'archived' then 'student_archived'
    when old.status = 'archived' and new.status <> 'archived' then 'student_restored'
    else 'student_updated'
  end;
  insert into public.activity_log (institute_id, actor_profile_id, action, entity, entity_id, data, created_at)
  values (
    new.institute_id, auth.uid(), action, 'students', new.id,
    jsonb_build_object('actor_name', public.actor_name(), 'changes', changes - 'status'),
    clock_timestamp()
  );
  return new;
end;
$$;

revoke all on function public.log_student_change() from public, anon, authenticated;

drop trigger if exists students_log_change on public.students;
create trigger students_log_change
after insert or update on public.students
for each row execute function public.log_student_change();

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
    where field.key in ('start_date', 'end_date', 'course_id')
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
      'changes', changes
    )),
    clock_timestamp()
  );
  return new;
end;
$$;

revoke all on function public.log_enrollment_change() from public, anon, authenticated;

drop trigger if exists enrollments_log_change on public.enrollments;
create trigger enrollments_log_change
after insert or update on public.enrollments
for each row execute function public.log_enrollment_change();

-- Append-only, read with students.history.
revoke update, delete on public.activity_log from authenticated;

drop policy if exists activity_log_admin on public.activity_log;
drop policy if exists activity_log_select on public.activity_log;
create policy activity_log_select on public.activity_log
for select to authenticated
using (
  institute_id = public.current_institute_id()
  and public.has_permission('students.history')
);

drop policy if exists activity_log_insert on public.activity_log;
create policy activity_log_insert on public.activity_log
for insert to authenticated
with check (
  institute_id = public.current_institute_id()
  and public.current_role() in ('admin', 'teacher')
  and actor_profile_id = auth.uid()
);
