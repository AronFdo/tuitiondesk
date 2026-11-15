-- TuitionDesk — Cambridge English entries through the British Council.
-- Students get the details a candidate entry needs, students on a course are
-- entered for the course's sitting one by one or in bulk, exam fees are paid
-- against an entry, and supporting documents (ID copies, photos, statements
-- of entry) are kept in a private bucket only admins can read.
-- Run this in the Supabase SQL editor after 012_exam_due_date.sql. Safe to re-run.

alter table public.students
  add column if not exists date_of_birth date,
  add column if not exists gender text,
  add column if not exists id_type text,
  add column if not exists id_number text,
  add column if not exists name_on_certificate text;

alter table public.students drop constraint if exists students_gender_check;
alter table public.students
  add constraint students_gender_check check (gender in ('female', 'male'));
alter table public.students drop constraint if exists students_id_type_check;
alter table public.students
  add constraint students_id_type_check check (id_type in ('nic', 'passport'));

create table if not exists public.exam_registrations (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete restrict,
  course_id uuid not null references public.courses (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  -- The sitting this entry is for. A course sits its exam every year, so
  -- last year's entries keep last year's date.
  exam_date date not null,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'confirmed', 'withdrawn')),
  -- Standard or late fee, fixed when the entry is made.
  fee_minor integer not null check (fee_minor >= 0),
  candidate_number text,
  result text,
  submitted_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, student_id, exam_date)
);

create table if not exists public.exam_payments (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete restrict,
  course_id uuid not null references public.courses (id) on delete restrict,
  registration_id uuid not null references public.exam_registrations (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  amount_minor integer not null check (amount_minor > 0),
  paid_on date not null,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_documents (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  -- Set for paperwork about one entry; null for the student's own documents,
  -- which are reused for every exam.
  registration_id uuid references public.exam_registrations (id) on delete restrict,
  kind text not null check (
    kind in (
      'id_copy', 'passport', 'birth_certificate', 'photo',
      'payment_proof', 'statement_of_entry', 'result_slip', 'certificate', 'other'
    )
  ),
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exam_registrations_course_idx
  on public.exam_registrations (course_id, exam_date);
create index if not exists exam_payments_registration_idx
  on public.exam_payments (registration_id);
create index if not exists student_documents_student_idx
  on public.student_documents (student_id);

drop trigger if exists exam_registrations_set_updated_at on public.exam_registrations;
create trigger exam_registrations_set_updated_at
before update on public.exam_registrations
for each row execute function public.set_updated_at();

drop trigger if exists exam_payments_set_updated_at on public.exam_payments;
create trigger exam_payments_set_updated_at
before update on public.exam_payments
for each row execute function public.set_updated_at();

drop trigger if exists student_documents_set_updated_at on public.student_documents;
create trigger student_documents_set_updated_at
before update on public.student_documents
for each row execute function public.set_updated_at();

-- Definer checks so policies never read students or registrations under row
-- level security.
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

create or replace function public.registration_for_student(
  p_registration_id uuid,
  p_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.exam_registrations registration
    where registration.id = p_registration_id
      and registration.student_id = p_student_id
      and registration.institute_id = public.current_institute_id()
  );
$$;

revoke all on function public.student_in_current_institute(uuid) from public, anon;
create or replace function public.registration_on_course(
  p_registration_id uuid,
  p_student_id uuid,
  p_course_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.exam_registrations registration
    where registration.id = p_registration_id
      and registration.student_id = p_student_id
      and registration.course_id = p_course_id
      and registration.institute_id = public.current_institute_id()
  );
$$;

revoke all on function public.registration_for_student(uuid, uuid) from public, anon;
revoke all on function public.registration_on_course(uuid, uuid, uuid) from public, anon;
grant execute on function public.student_in_current_institute(uuid) to authenticated;
grant execute on function public.registration_for_student(uuid, uuid) to authenticated;
grant execute on function public.registration_on_course(uuid, uuid, uuid) to authenticated;

alter table public.exam_registrations enable row level security;
alter table public.exam_payments enable row level security;
alter table public.student_documents enable row level security;

grant select, insert, update on public.exam_registrations to authenticated, service_role;
grant select, insert, update on public.exam_payments to authenticated, service_role;
grant select, insert, delete on public.student_documents to authenticated, service_role;

revoke all on public.exam_registrations from anon;
revoke all on public.exam_payments from anon;
revoke all on public.student_documents from anon;

drop policy if exists exam_registrations_select on public.exam_registrations;
create policy exam_registrations_select on public.exam_registrations
for select to authenticated
using (
  institute_id = public.current_institute_id()
  and (
    public.current_role() = 'admin'
    or public.teacher_teaches_course(course_id)
  )
);

drop policy if exists exam_registrations_insert_admin on public.exam_registrations;
create policy exam_registrations_insert_admin on public.exam_registrations
for insert to authenticated
with check (
  institute_id = public.current_institute_id()
  and public.current_role() = 'admin'
  and public.course_in_current_institute(course_id)
  and public.student_on_course(student_id, course_id)
);

drop policy if exists exam_registrations_update_admin on public.exam_registrations;
create policy exam_registrations_update_admin on public.exam_registrations
for update to authenticated
using (
  institute_id = public.current_institute_id()
  and public.current_role() = 'admin'
)
with check (
  institute_id = public.current_institute_id()
  and public.current_role() = 'admin'
);

drop policy if exists exam_payments_select on public.exam_payments;
create policy exam_payments_select on public.exam_payments
for select to authenticated
using (
  institute_id = public.current_institute_id()
  and public.current_role() = 'admin'
);

drop policy if exists exam_payments_insert_admin on public.exam_payments;
create policy exam_payments_insert_admin on public.exam_payments
for insert to authenticated
with check (
  institute_id = public.current_institute_id()
  and public.current_role() = 'admin'
  and public.course_in_current_institute(course_id)
  and public.registration_on_course(registration_id, student_id, course_id)
);

drop policy if exists exam_payments_update_admin on public.exam_payments;
create policy exam_payments_update_admin on public.exam_payments
for update to authenticated
using (
  institute_id = public.current_institute_id()
  and public.current_role() = 'admin'
)
with check (
  institute_id = public.current_institute_id()
  and public.current_role() = 'admin'
);

-- Identity documents of children: admins only, never teachers or parents.
drop policy if exists student_documents_select_admin on public.student_documents;
create policy student_documents_select_admin on public.student_documents
for select to authenticated
using (
  institute_id = public.current_institute_id()
  and public.current_role() = 'admin'
);

drop policy if exists student_documents_insert_admin on public.student_documents;
create policy student_documents_insert_admin on public.student_documents
for insert to authenticated
with check (
  institute_id = public.current_institute_id()
  and public.current_role() = 'admin'
  and public.student_in_current_institute(student_id)
  and (
    registration_id is null
    or public.registration_for_student(registration_id, student_id)
  )
);

drop policy if exists student_documents_delete_admin on public.student_documents;
create policy student_documents_delete_admin on public.student_documents
for delete to authenticated
using (
  institute_id = public.current_institute_id()
  and public.current_role() = 'admin'
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-documents',
  'student-documents',
  false,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists student_documents_storage_select on storage.objects;
create policy student_documents_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'student-documents'
  and (storage.foldername(name))[1] = public.current_institute_id()::text
  and public.current_role() = 'admin'
);

drop policy if exists student_documents_storage_insert on storage.objects;
create policy student_documents_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'student-documents'
  and (storage.foldername(name))[1] = public.current_institute_id()::text
  and public.current_role() = 'admin'
);

drop policy if exists student_documents_storage_delete on storage.objects;
create policy student_documents_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'student-documents'
  and (storage.foldername(name))[1] = public.current_institute_id()::text
  and public.current_role() = 'admin'
);
