-- TuitionDesk — the parent portal: notices staff post to a course or the
-- whole class, read access for a parent to their own child's fees and exam
-- entries, and when each person last opened the portal.
-- Run this in the Supabase SQL editor after 016_postal_id.sql. Safe to re-run.

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete restrict,
  -- Null for a notice to the whole class.
  course_id uuid references public.courses (id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  -- Shown up to and including this day; null keeps it up until removed.
  show_until date,
  created_by uuid references public.profiles (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notices_institute_idx
  on public.notices (institute_id, created_at desc)
  where archived_at is null;

drop trigger if exists notices_set_updated_at on public.notices;
create trigger notices_set_updated_at
before update on public.notices
for each row execute function public.set_updated_at();

alter table public.notices enable row level security;
grant select, insert, update on public.notices to authenticated, service_role;
revoke all on public.notices from anon;

drop policy if exists notices_select on public.notices;
create policy notices_select on public.notices
for select to authenticated
using (
  institute_id = public.current_institute_id()
  and (
    public.current_role() = 'admin'
    or (
      public.current_role() = 'teacher'
      and (course_id is null or public.teacher_teaches_course(course_id))
    )
    or (
      public.current_role() = 'parent'
      and archived_at is null
      and (course_id is null or public.parent_can_read_course(course_id))
    )
  )
);

-- Admins post anywhere; a teacher posts only to their own courses.
drop policy if exists notices_insert_staff on public.notices;
create policy notices_insert_staff on public.notices
for insert to authenticated
with check (
  institute_id = public.current_institute_id()
  and created_by = auth.uid()
  and archived_at is null
  and (
    (public.current_role() = 'admin'
      and (course_id is null or public.course_in_current_institute(course_id)))
    or (public.current_role() = 'teacher'
      and course_id is not null
      and public.teacher_teaches_course(course_id))
  )
);

-- Notices are removed by archiving, never deleted.
drop policy if exists notices_update_staff on public.notices;
create policy notices_update_staff on public.notices
for update to authenticated
using (
  institute_id = public.current_institute_id()
  and (
    public.current_role() = 'admin'
    or (public.current_role() = 'teacher'
      and course_id is not null
      and public.teacher_teaches_course(course_id))
  )
)
with check (
  institute_id = public.current_institute_id()
);

-- A parent reads their own child's fees and entries; nothing else.
drop policy if exists tuition_payments_select on public.tuition_payments;
create policy tuition_payments_select on public.tuition_payments
for select to authenticated
using (
  institute_id = public.current_institute_id()
  and (
    public.current_role() = 'admin'
    or (
      public.current_role() = 'parent'
      and voided_at is null
      and public.parent_has_student(student_id)
    )
  )
);

drop policy if exists exam_registrations_select on public.exam_registrations;
create policy exam_registrations_select on public.exam_registrations
for select to authenticated
using (
  institute_id = public.current_institute_id()
  and (
    public.current_role() = 'admin'
    or public.teacher_teaches_course(course_id)
    or (
      public.current_role() = 'parent'
      and public.parent_has_student(student_id)
    )
  )
);

drop policy if exists exam_payments_select on public.exam_payments;
create policy exam_payments_select on public.exam_payments
for select to authenticated
using (
  institute_id = public.current_institute_id()
  and (
    public.current_role() = 'admin'
    or (
      public.current_role() = 'parent'
      and voided_at is null
      and public.parent_has_student(student_id)
    )
  )
);

-- "New since your last visit" in the portal. A visit is a run of page loads
-- with less than 30 minutes between them; previous_seen_at is when the visit
-- before this one was, so what is new stays new until the parent leaves.
alter table public.memberships
  add column if not exists last_seen_at timestamptz,
  add column if not exists previous_seen_at timestamptz;

-- Portal users cannot write memberships, so this touches only the caller's
-- own row and returns when their previous visit was (null on the first).
create or replace function public.touch_last_seen()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  result timestamptz;
begin
  update public.memberships m
  set previous_seen_at = case
        when m.last_seen_at is null or m.last_seen_at < now() - interval '30 minutes'
          then m.last_seen_at
        else m.previous_seen_at
      end,
      last_seen_at = now()
  where m.profile_id = auth.uid()
    and m.institute_id = public.current_institute_id()
  returning m.previous_seen_at into result;

  return result;
end;
$$;

revoke all on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;
