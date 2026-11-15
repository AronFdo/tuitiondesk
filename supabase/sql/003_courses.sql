-- TuitionDesk — courses belong to a class, and students belong to a course.
-- A course prepares students for one Cambridge English exam, so the exam's
-- level and this year's sitting live on the course. The exam repeats every
-- year; only the sitting's dates and fees change.
-- Run this in the Supabase SQL editor after 002_institute_logos.sql.
-- Safe to re-run: tables are created only if missing; policies and triggers are replaced.

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete restrict,
  name text not null,
  teacher_profile_id uuid references public.profiles (id) on delete restrict,
  schedule_text text,
  monthly_fee_minor integer not null default 0 check (monthly_fee_minor >= 0),
  tuition_due_day smallint check (tuition_due_day between 1 and 31),
  exam_due_on date,
  description text,
  -- The exam the course prepares for.
  board text not null default 'cambridge_english' check (board in ('cambridge_english')),
  level text not null check (
    level in (
      'pre_a1_starters', 'a1_movers', 'a2_flyers',
      'a2_key', 'a2_key_schools',
      'b1_preliminary', 'b1_preliminary_schools',
      'b2_first', 'b2_first_schools',
      'c1_advanced', 'c2_proficiency'
    )
  ),
  format text not null default 'paper' check (format in ('paper', 'digital')),
  -- This year's sitting. Empty until the British Council calendar is out.
  exam_date date,
  exam_fee_minor integer not null default 0 check (exam_fee_minor >= 0),
  late_fee_minor integer check (late_fee_minor is null or late_fee_minor >= 0),
  registration_opens_on date,
  registration_closes_on date,
  late_closes_on date,
  speaking_from date,
  speaking_to date,
  venue text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    registration_closes_on is null
    or exam_date is null
    or registration_closes_on <= exam_date
  ),
  check (
    late_closes_on is null
    or registration_closes_on is null
    or late_closes_on >= registration_closes_on
  )
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete restrict,
  full_name text not null,
  guardian_name text,
  guardian_phone text,
  notes text,
  portal_enabled boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete restrict,
  course_id uuid not null references public.courses (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create unique index if not exists enrollments_open_course_student
on public.enrollments (course_id, student_id)
where end_date is null;

drop trigger if exists courses_set_updated_at on public.courses;
create trigger courses_set_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at
before update on public.students
for each row execute function public.set_updated_at();

drop trigger if exists enrollments_set_updated_at on public.enrollments;
create trigger enrollments_set_updated_at
before update on public.enrollments
for each row execute function public.set_updated_at();

-- One transaction so a student is never saved without the course they belong to.
create or replace function public.add_student_to_course(
  p_course_id uuid,
  p_full_name text,
  p_guardian_name text,
  p_guardian_phone text,
  p_start_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  course_institute_id uuid;
  new_student_id uuid;
  clean_name text := nullif(btrim(p_full_name), '');
begin
  if clean_name is null then
    raise exception 'name required';
  end if;

  if public.current_role() is distinct from 'admin' then
    raise exception 'not allowed';
  end if;

  select c.institute_id
  into course_institute_id
  from public.courses c
  where c.id = p_course_id
    and c.archived_at is null;

  if course_institute_id is null
    or course_institute_id is distinct from public.current_institute_id() then
    raise exception 'course not found';
  end if;

  insert into public.students (
    institute_id,
    full_name,
    guardian_name,
    guardian_phone,
    status,
    portal_enabled
  )
  values (
    course_institute_id,
    clean_name,
    nullif(btrim(p_guardian_name), ''),
    nullif(btrim(p_guardian_phone), ''),
    'active',
    false
  )
  returning id into new_student_id;

  insert into public.enrollments (
    institute_id,
    course_id,
    student_id,
    start_date
  )
  values (
    course_institute_id,
    p_course_id,
    new_student_id,
    coalesce(p_start_date, current_date)
  );

  return new_student_id;
end;
$$;

revoke all on function public.add_student_to_course(uuid, text, text, text, date) from public, anon;
grant execute on function public.add_student_to_course(uuid, text, text, text, date) to authenticated;

-- These checks run as the definer so a student policy and an enrollment
-- policy never query each other. A direct cross-check loops forever.
create or replace function public.student_in_current_institute(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.students student
    where student.id = p_student_id
      and student.institute_id = public.current_institute_id()
  );
$$;

create or replace function public.teacher_has_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.enrollments enrollment
    join public.courses course on course.id = enrollment.course_id
    where enrollment.student_id = p_student_id
      and enrollment.end_date is null
      and enrollment.institute_id = public.current_institute_id()
      and course.teacher_profile_id = auth.uid()
  );
$$;

create or replace function public.teacher_teaches_course(p_course_id uuid)
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
      and course.teacher_profile_id = auth.uid()
  );
$$;

revoke all on function public.student_in_current_institute(uuid) from public, anon;
revoke all on function public.teacher_has_student(uuid) from public, anon;
revoke all on function public.teacher_teaches_course(uuid) from public, anon;
grant execute on function public.student_in_current_institute(uuid) to authenticated;
grant execute on function public.teacher_has_student(uuid) to authenticated;
grant execute on function public.teacher_teaches_course(uuid) to authenticated;

alter table public.courses enable row level security;
alter table public.students enable row level security;
alter table public.enrollments enable row level security;

grant select, insert, update on public.courses to authenticated, service_role;
grant select, insert, update on public.students to authenticated, service_role;
grant select, insert, update on public.enrollments to authenticated, service_role;

revoke all on public.courses from anon;
revoke all on public.students from anon;
revoke all on public.enrollments from anon;

drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses
for select to authenticated
using (
  institute_id = public.current_institute_id()
  and (
    public.current_role() = 'admin'
    or teacher_profile_id = auth.uid()
  )
);

drop policy if exists courses_insert_admin on public.courses;
create policy courses_insert_admin on public.courses
for insert to authenticated
with check (
  institute_id = public.current_institute_id()
  and public.current_role() = 'admin'
  and (
    teacher_profile_id is null
    or exists (
      select 1
      from public.memberships membership
      where membership.profile_id = teacher_profile_id
        and membership.institute_id = institute_id
        and membership.role in ('admin', 'teacher')
    )
  )
);

drop policy if exists courses_update_admin on public.courses;
create policy courses_update_admin on public.courses
for update to authenticated
using (
  institute_id = public.current_institute_id()
  and public.current_role() = 'admin'
)
with check (
  institute_id = public.current_institute_id()
  and public.current_role() = 'admin'
);

drop policy if exists students_select on public.students;
create policy students_select on public.students
for select to authenticated
using (
  institute_id = public.current_institute_id()
  and (
    public.current_role() = 'admin'
    or public.teacher_has_student(id)
  )
);

drop policy if exists students_insert_admin on public.students;
create policy students_insert_admin on public.students
for insert to authenticated
with check (
  institute_id = public.current_institute_id()
  and public.current_role() = 'admin'
);

drop policy if exists students_update_admin on public.students;
create policy students_update_admin on public.students
for update to authenticated
using (
  institute_id = public.current_institute_id()
  and public.current_role() = 'admin'
)
with check (
  institute_id = public.current_institute_id()
  and public.current_role() = 'admin'
);

drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select on public.enrollments
for select to authenticated
using (
  institute_id = public.current_institute_id()
  and (
    public.current_role() = 'admin'
    or public.teacher_teaches_course(course_id)
  )
);

drop policy if exists enrollments_insert_admin on public.enrollments;
create policy enrollments_insert_admin on public.enrollments
for insert to authenticated
with check (
  institute_id = public.current_institute_id()
  and public.current_role() = 'admin'
  and exists (
    select 1
    from public.courses course
    where course.id = course_id
      and course.institute_id = institute_id
  )
  and public.student_in_current_institute(student_id)
);

drop policy if exists enrollments_update_admin on public.enrollments;
create policy enrollments_update_admin on public.enrollments
for update to authenticated
using (
  institute_id = public.current_institute_id()
  and public.current_role() = 'admin'
)
with check (
  institute_id = public.current_institute_id()
  and public.current_role() = 'admin'
);
