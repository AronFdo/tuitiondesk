-- TuitionDesk — notes and worksheets on a course, readable by a parent login.
-- Run this in the Supabase SQL editor after 008_course_dues.sql.
-- A parent sees files only for courses their linked child is still attending.

create or replace function public.current_institute_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.active_institute_id
  from public.profiles p
  where p.id = auth.uid()
    and exists (
      select 1
      from public.memberships m
      where m.profile_id = p.id
        and m.institute_id = p.active_institute_id
        and m.role in ('admin', 'teacher', 'parent')
    );
$$;

create table if not exists public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete restrict,
  guardian_profile_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guardian_profile_id, student_id)
);

create table if not exists public.course_files (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete restrict,
  course_id uuid not null references public.courses (id) on delete restrict,
  kind text not null check (kind in ('note', 'worksheet')),
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 26214400),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists guardian_links_set_updated_at on public.guardian_links;
create trigger guardian_links_set_updated_at
before update on public.guardian_links
for each row execute function public.set_updated_at();

drop trigger if exists course_files_set_updated_at on public.course_files;
create trigger course_files_set_updated_at
before update on public.course_files
for each row execute function public.set_updated_at();

create or replace function public.parent_has_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.guardian_links link
    where link.guardian_profile_id = auth.uid()
      and link.student_id = p_student_id
      and link.institute_id = public.current_institute_id()
  );
$$;

create or replace function public.parent_can_read_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.guardian_links link
    join public.enrollments enrollment
      on enrollment.student_id = link.student_id
      and enrollment.institute_id = link.institute_id
    where link.guardian_profile_id = auth.uid()
      and link.institute_id = public.current_institute_id()
      and enrollment.course_id = p_course_id
      and enrollment.end_date is null
  );
$$;

revoke all on function public.parent_has_student(uuid) from public, anon;
revoke all on function public.parent_can_read_course(uuid) from public, anon;
grant execute on function public.parent_has_student(uuid) to authenticated;
grant execute on function public.parent_can_read_course(uuid) to authenticated;

alter table public.guardian_links enable row level security;
alter table public.course_files enable row level security;

grant select, insert on public.guardian_links to authenticated, service_role;
grant select, insert, delete on public.course_files to authenticated, service_role;

revoke all on public.guardian_links from anon;
revoke all on public.course_files from anon;

drop policy if exists guardian_links_select on public.guardian_links;
create policy guardian_links_select on public.guardian_links
for select to authenticated
using (
  guardian_profile_id = auth.uid()
  or (
    institute_id = public.current_institute_id()
    and public.current_role() = 'admin'
  )
);

drop policy if exists guardian_links_insert_admin on public.guardian_links;
create policy guardian_links_insert_admin on public.guardian_links
for insert to authenticated
with check (
  institute_id = public.current_institute_id()
  and public.current_role() = 'admin'
  and public.student_in_current_institute(student_id)
);

drop policy if exists course_files_select on public.course_files;
create policy course_files_select on public.course_files
for select to authenticated
using (
  institute_id = public.current_institute_id()
  and (
    public.current_role() = 'admin'
    or public.teacher_teaches_course(course_id)
    or public.parent_can_read_course(course_id)
  )
);

drop policy if exists course_files_insert_staff on public.course_files;
create policy course_files_insert_staff on public.course_files
for insert to authenticated
with check (
  institute_id = public.current_institute_id()
  and (
    public.current_role() = 'admin'
    or public.teacher_teaches_course(course_id)
  )
);

drop policy if exists course_files_delete_staff on public.course_files;
create policy course_files_delete_staff on public.course_files
for delete to authenticated
using (
  institute_id = public.current_institute_id()
  and (
    public.current_role() = 'admin'
    or public.teacher_teaches_course(course_id)
  )
);

drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses
for select to authenticated
using (
  institute_id = public.current_institute_id()
  and (
    public.current_role() = 'admin'
    or teacher_profile_id = auth.uid()
    or public.parent_can_read_course(id)
  )
);

drop policy if exists students_select on public.students;
create policy students_select on public.students
for select to authenticated
using (
  institute_id = public.current_institute_id()
  and (
    public.current_role() = 'admin'
    or public.teacher_has_student(id)
    or public.parent_has_student(id)
  )
);

drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select on public.enrollments
for select to authenticated
using (
  institute_id = public.current_institute_id()
  and (
    public.current_role() = 'admin'
    or public.teacher_teaches_course(course_id)
    or public.parent_has_student(student_id)
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-files',
  'course-files',
  false,
  26214400,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists course_files_storage_select on storage.objects;
create policy course_files_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'course-files'
  and (
    (
      (storage.foldername(name))[1] = public.current_institute_id()::text
      and (
        public.current_role() = 'admin'
        or public.teacher_teaches_course(((storage.foldername(name))[2])::uuid)
      )
    )
    or public.parent_can_read_course(((storage.foldername(name))[2])::uuid)
  )
);

drop policy if exists course_files_storage_insert on storage.objects;
create policy course_files_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'course-files'
  and (storage.foldername(name))[1] = public.current_institute_id()::text
  and (
    public.current_role() = 'admin'
    or public.teacher_teaches_course(((storage.foldername(name))[2])::uuid)
  )
);

drop policy if exists course_files_storage_delete on storage.objects;
create policy course_files_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'course-files'
  and (storage.foldername(name))[1] = public.current_institute_id()::text
  and (
    public.current_role() = 'admin'
    or public.teacher_teaches_course(((storage.foldername(name))[2])::uuid)
  )
);
