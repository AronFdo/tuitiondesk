-- TuitionDesk — every student gets an identity for their card: a short code
-- people can read ("TD-00042") and a random token the QR code carries. The QR
-- holds only the token, never a name, phone or row id, and reissuing a lost
-- card swaps the token so the old card stops working. Students also get a
-- profile photo in a private bucket, and admins can bring in a whole list of
-- students from a spreadsheet in one go.
-- Run this in the Supabase SQL editor after 017_family_portal.sql. Safe to re-run.

alter table public.students
  add column if not exists student_code text,
  add column if not exists qr_token text,
  add column if not exists qr_issued_at timestamptz,
  add column if not exists photo_path text;

-- Running numbers per institute (student codes now, receipt numbers later).
-- Only definer functions touch it, so it has no policies.
create table if not exists public.institute_counters (
  institute_id uuid not null references public.institutes (id) on delete restrict,
  name text not null,
  value bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (institute_id, name)
);

alter table public.institute_counters enable row level security;
revoke all on public.institute_counters from public, anon, authenticated;

create or replace function public.next_institute_counter(p_institute_id uuid, p_name text)
returns bigint
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.institute_counters as counter (institute_id, name, value)
  values (p_institute_id, p_name, 1)
  on conflict (institute_id, name)
  do update set value = counter.value + 1, updated_at = now()
  returning counter.value;
$$;

revoke all on function public.next_institute_counter(uuid, text) from public, anon, authenticated;

-- 32 hex characters, 122 random bits.
create or replace function public.new_qr_token()
returns text
language sql
volatile
set search_path = public
as $$
  select replace(gen_random_uuid()::text, '-', '');
$$;

revoke all on function public.new_qr_token() from public, anon;
grant execute on function public.new_qr_token() to authenticated;

create or replace function public.format_student_code(p_number bigint)
returns text
language sql
immutable
as $$
  select 'TD-' || lpad(p_number::text, 5, '0');
$$;

-- Fill in the code and token for every new student, whichever path adds them.
create or replace function public.assign_student_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.student_code is null then
    new.student_code := public.format_student_code(
      public.next_institute_counter(new.institute_id, 'student_code')
    );
  end if;
  if new.qr_token is null then
    new.qr_token := public.new_qr_token();
    new.qr_issued_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.assign_student_identity() from public, anon, authenticated;

drop trigger if exists students_assign_identity on public.students;
create trigger students_assign_identity
before insert on public.students
for each row execute function public.assign_student_identity();

-- Codes never change once given. Tokens change only when a card is reissued.
create or replace function public.keep_student_code()
returns trigger
language plpgsql
as $$
begin
  if old.student_code is not null and new.student_code is distinct from old.student_code then
    raise exception 'student code cannot change';
  end if;
  if old.qr_token is not null and new.qr_token is null then
    raise exception 'qr token required';
  end if;
  return new;
end;
$$;

drop trigger if exists students_keep_code on public.students;
create trigger students_keep_code
before update of student_code, qr_token on public.students
for each row execute function public.keep_student_code();

-- Students added before this file, in the order they joined.
do $$
declare
  student record;
begin
  for student in
    select id, institute_id
    from public.students
    where student_code is null
    order by institute_id, created_at, id
  loop
    -- Code and token together: one update, so no row is ever half done.
    update public.students
    set student_code = public.format_student_code(
          public.next_institute_counter(student.institute_id, 'student_code')
        ),
        qr_token = coalesce(qr_token, public.new_qr_token()),
        qr_issued_at = coalesce(qr_issued_at, now())
    where id = student.id;
  end loop;

  -- Anyone who already had a code but no token (a run that stopped midway).
  update public.students
  set qr_token = public.new_qr_token(),
      qr_issued_at = now()
  where qr_token is null;
end;
$$;

alter table public.students alter column student_code set not null;
alter table public.students alter column qr_token set not null;

create unique index if not exists students_institute_code_key
  on public.students (institute_id, student_code);
create unique index if not exists students_qr_token_key
  on public.students (qr_token);

-- Profile photos: one small square image per student, in
-- <institute_id>/<student_id>/<file>. Admins manage them; a teacher can see
-- the photos of students in their own courses.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-photos',
  'student-photos',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists student_photos_select on storage.objects;
create policy student_photos_select on storage.objects
for select to authenticated
using (
  bucket_id = 'student-photos'
  and (storage.foldername(name))[1] = public.current_institute_id()::text
  and (
    public.current_role() = 'admin'
    or case
      when (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
        then public.teacher_has_student(((storage.foldername(name))[2])::uuid)
      else false
    end
  )
);

drop policy if exists student_photos_insert on storage.objects;
create policy student_photos_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'student-photos'
  and (storage.foldername(name))[1] = public.current_institute_id()::text
  and public.current_role() = 'admin'
);

drop policy if exists student_photos_delete on storage.objects;
create policy student_photos_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'student-photos'
  and (storage.foldername(name))[1] = public.current_institute_id()::text
  and public.current_role() = 'admin'
);

-- Bulk import: every row goes in, or none do. Each row is
-- {full_name, date_of_birth, gender, guardian_name, guardian_phone, notes,
--  course_ids: [uuid, ...]}. The app has already checked and cleaned the rows;
-- this checks again what the database can see (the caller, the courses).
create or replace function public.import_students(p_rows jsonb, p_start_date date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  institute uuid := public.current_institute_id();
  row_data jsonb;
  course_text text;
  new_student_id uuid;
  clean_name text;
  added integer := 0;
begin
  if public.current_role() is distinct from 'admin' then
    raise exception 'not allowed';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'rows required';
  end if;
  if jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 1000 then
    raise exception 'between 1 and 1000 rows';
  end if;

  for row_data in select value from jsonb_array_elements(p_rows)
  loop
    clean_name := nullif(btrim(row_data ->> 'full_name'), '');
    if clean_name is null then
      raise exception 'name required';
    end if;

    insert into public.students (
      institute_id,
      full_name,
      date_of_birth,
      gender,
      guardian_name,
      guardian_phone,
      notes,
      status,
      portal_enabled
    )
    values (
      institute,
      clean_name,
      nullif(row_data ->> 'date_of_birth', '')::date,
      nullif(btrim(row_data ->> 'gender'), ''),
      nullif(btrim(row_data ->> 'guardian_name'), ''),
      nullif(btrim(row_data ->> 'guardian_phone'), ''),
      nullif(btrim(row_data ->> 'notes'), ''),
      'active',
      false
    )
    returning id into new_student_id;

    for course_text in
      select distinct value from jsonb_array_elements_text(coalesce(row_data -> 'course_ids', '[]'::jsonb))
    loop
      if not exists (
        select 1
        from public.courses course
        where course.id = course_text::uuid
          and course.institute_id = institute
          and course.archived_at is null
      ) then
        raise exception 'course not found';
      end if;

      insert into public.enrollments (institute_id, course_id, student_id, start_date)
      values (institute, course_text::uuid, new_student_id, coalesce(p_start_date, current_date));
    end loop;

    added := added + 1;
  end loop;

  insert into public.activity_log (institute_id, actor_profile_id, action, entity, data)
  values (institute, auth.uid(), 'students_imported', 'students', jsonb_build_object('count', added));

  return added;
end;
$$;

revoke all on function public.import_students(jsonb, date) from public, anon;
grant execute on function public.import_students(jsonb, date) to authenticated;
