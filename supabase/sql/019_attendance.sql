-- TuitionDesk — attendance by QR card. Staff start a session for a class on a
-- day, and every card scanned (or name ticked) while it is open marks that
-- student present. Absent means enrolled but not marked. The class owner can
-- run any class; a teacher can run the classes they teach.
-- Run this in the Supabase SQL editor after 018_student_identity.sql. Safe to re-run.

create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete restrict,
  course_id uuid not null references public.courses (id) on delete restrict,
  held_on date not null,
  opened_at timestamptz not null default now(),
  opened_by uuid references public.profiles (id) on delete set null,
  closed_at timestamptz,
  closed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, held_on)
);

create index if not exists class_sessions_institute_day
  on public.class_sessions (institute_id, held_on desc);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete restrict,
  session_id uuid not null references public.class_sessions (id) on delete restrict,
  -- Copied from the session so row policies need no join.
  course_id uuid not null references public.courses (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  scanned_at timestamptz not null default now(),
  source text not null check (source in ('scanner', 'camera', 'manual')),
  recorded_by uuid references public.profiles (id) on delete set null,
  -- A mark taken back (scanned by mistake). Scanning again restores it.
  voided_at timestamptz,
  voided_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create index if not exists attendance_student on public.attendance (student_id, scanned_at desc);

-- The class owner runs every class; a teacher runs their own.
create or replace function public.can_run_course(p_course_id uuid)
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
      and (
        public.current_role() = 'admin'
        or (public.current_role() = 'teacher' and course.teacher_profile_id = auth.uid())
      )
  );
$$;

revoke all on function public.can_run_course(uuid) from public, anon;
grant execute on function public.can_run_course(uuid) to authenticated;

alter table public.class_sessions enable row level security;
alter table public.attendance enable row level security;

-- Reads go through policies; every write goes through the functions below.
revoke all on public.class_sessions from anon, authenticated;
revoke all on public.attendance from anon, authenticated;
grant select on public.class_sessions to authenticated;
grant select on public.attendance to authenticated;
grant all on public.class_sessions to service_role;
grant all on public.attendance to service_role;

drop policy if exists class_sessions_select on public.class_sessions;
create policy class_sessions_select on public.class_sessions
for select to authenticated
using (
  institute_id = public.current_institute_id()
  and public.can_run_course(course_id)
);

drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance
for select to authenticated
using (
  institute_id = public.current_institute_id()
  and public.can_run_course(course_id)
);

-- Start (or carry on with) the session for a class on a day. Opening a day
-- that was closed opens it again.
create or replace function public.open_class_session(p_course_id uuid, p_held_on date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  institute uuid := public.current_institute_id();
  new_session_id uuid;
  today date := (now() at time zone 'Asia/Colombo')::date;
begin
  if not public.can_run_course(p_course_id) then
    raise exception 'not allowed';
  end if;
  if not exists (
    select 1 from public.courses where id = p_course_id and archived_at is null
  ) then
    raise exception 'course not found';
  end if;
  if p_held_on is null or p_held_on > today or p_held_on < today - 366 then
    raise exception 'bad date';
  end if;

  insert into public.class_sessions (institute_id, course_id, held_on, opened_by)
  values (institute, p_course_id, p_held_on, auth.uid())
  on conflict (course_id, held_on)
  do update set closed_at = null, closed_by = null, updated_at = now()
  returning id into new_session_id;

  return new_session_id;
end;
$$;

create or replace function public.close_class_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  session_course uuid;
begin
  select course_id into session_course
  from public.class_sessions
  where id = p_session_id and institute_id = public.current_institute_id();
  if session_course is null or not public.can_run_course(session_course) then
    raise exception 'not allowed';
  end if;

  update public.class_sessions
  set closed_at = coalesce(closed_at, now()),
      closed_by = coalesce(closed_by, auth.uid()),
      updated_at = now()
  where id = p_session_id;
end;
$$;

-- One scanned card. Returns what happened, for the scan screen:
-- {status: marked | already | unknown_card | not_enrolled | archived | closed,
--  student_id, full_name, student_code}
create or replace function public.record_scan(
  p_session_id uuid,
  p_token text,
  p_source text,
  p_scanned_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  institute uuid := public.current_institute_id();
  sess public.class_sessions%rowtype;
  student record;
  marked_id uuid;
  scan_time timestamptz := least(coalesce(p_scanned_at, now()), now() + interval '5 minutes');
begin
  if p_source not in ('scanner', 'camera') then
    raise exception 'bad source';
  end if;

  select * into sess
  from public.class_sessions
  where id = p_session_id and institute_id = institute;
  if sess.id is null or not public.can_run_course(sess.course_id) then
    raise exception 'not allowed';
  end if;
  if sess.closed_at is not null then
    return jsonb_build_object('status', 'closed');
  end if;

  select id, full_name, student_code, status into student
  from public.students
  where qr_token = lower(btrim(p_token)) and institute_id = institute;
  if student.id is null then
    return jsonb_build_object('status', 'unknown_card');
  end if;
  if student.status <> 'active' then
    return jsonb_build_object(
      'status', 'archived',
      'student_id', student.id, 'full_name', student.full_name, 'student_code', student.student_code
    );
  end if;
  if not exists (
    select 1
    from public.enrollments enrollment
    where enrollment.course_id = sess.course_id
      and enrollment.student_id = student.id
      and enrollment.end_date is null
  ) then
    return jsonb_build_object(
      'status', 'not_enrolled',
      'student_id', student.id, 'full_name', student.full_name, 'student_code', student.student_code
    );
  end if;

  insert into public.attendance (
    institute_id, session_id, course_id, student_id, scanned_at, source, recorded_by
  )
  values (institute, sess.id, sess.course_id, student.id, scan_time, p_source, auth.uid())
  on conflict (session_id, student_id)
  do update set
    scanned_at = excluded.scanned_at,
    source = excluded.source,
    recorded_by = excluded.recorded_by,
    voided_at = null,
    voided_by = null,
    updated_at = now()
  where attendance.voided_at is not null
  returning id into marked_id;

  return jsonb_build_object(
    'status', case when marked_id is null then 'already' else 'marked' end,
    'student_id', student.id, 'full_name', student.full_name, 'student_code', student.student_code
  );
end;
$$;

-- Ticking a name by hand (a forgotten card), or taking a mark back.
create or replace function public.set_attendance(
  p_session_id uuid,
  p_student_id uuid,
  p_present boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  institute uuid := public.current_institute_id();
  sess public.class_sessions%rowtype;
begin
  select * into sess
  from public.class_sessions
  where id = p_session_id and institute_id = institute;
  if sess.id is null or not public.can_run_course(sess.course_id) then
    raise exception 'not allowed';
  end if;

  if p_present then
    if not exists (
      select 1
      from public.enrollments enrollment
      join public.students student on student.id = enrollment.student_id
      where enrollment.course_id = sess.course_id
        and enrollment.student_id = p_student_id
        and enrollment.end_date is null
        and student.status = 'active'
    ) then
      raise exception 'not enrolled';
    end if;

    insert into public.attendance (
      institute_id, session_id, course_id, student_id, scanned_at, source, recorded_by
    )
    values (institute, sess.id, sess.course_id, p_student_id, now(), 'manual', auth.uid())
    on conflict (session_id, student_id)
    do update set
      scanned_at = now(),
      source = 'manual',
      recorded_by = auth.uid(),
      voided_at = null,
      voided_by = null,
      updated_at = now()
    where attendance.voided_at is not null;
  else
    update public.attendance
    set voided_at = now(), voided_by = auth.uid(), updated_at = now()
    where session_id = sess.id
      and student_id = p_student_id
      and voided_at is null;
  end if;
end;
$$;

revoke all on function public.open_class_session(uuid, date) from public, anon;
revoke all on function public.close_class_session(uuid) from public, anon;
revoke all on function public.record_scan(uuid, text, text, timestamptz) from public, anon;
revoke all on function public.set_attendance(uuid, uuid, boolean) from public, anon;
grant execute on function public.open_class_session(uuid, date) to authenticated;
grant execute on function public.close_class_session(uuid) to authenticated;
grant execute on function public.record_scan(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.set_attendance(uuid, uuid, boolean) to authenticated;
