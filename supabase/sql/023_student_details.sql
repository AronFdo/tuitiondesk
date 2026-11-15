-- TuitionDesk — the full student record: first and last name, NIC, religion,
-- contact details, schooling and results, family, emergency contact, learning
-- mode and special needs. full_name stays, built from the first and last name,
-- so everything that shows a student's name keeps working unchanged.
-- Run this in the Supabase SQL editor after 022_import_returns_ids.sql. Safe to re-run.

alter table public.students
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists nic text,
  add column if not exists religion text,
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists occupation text,
  add column if not exists qualification text,
  add column if not exists school text,
  add column if not exists medium text,
  add column if not exists ol_results text,
  add column if not exists al_results text,
  add column if not exists father_name text,
  add column if not exists father_occupation text,
  add column if not exists mother_name text,
  add column if not exists mother_occupation text,
  add column if not exists guardian_occupation text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists learning_mode text,
  add column if not exists has_special_needs boolean not null default false,
  add column if not exists special_needs text;

do $$
begin
  alter table public.students drop constraint if exists students_medium_check;
  alter table public.students add constraint students_medium_check
    check (medium is null or medium in ('sinhala', 'tamil', 'english'));
  alter table public.students drop constraint if exists students_learning_mode_check;
  alter table public.students add constraint students_learning_mode_check
    check (learning_mode is null or learning_mode in ('online', 'physical'));
  alter table public.students drop constraint if exists students_nic_format;
  -- Old NIC: 9 digits and V or X. New NIC: 12 digits.
  alter table public.students add constraint students_nic_format
    check (nic is null or nic ~ '^([0-9]{9}[VX]|[0-9]{12})$');
  alter table public.students drop constraint if exists students_text_lengths;
  alter table public.students add constraint students_text_lengths check (
    char_length(coalesce(first_name, '')) <= 80
    and char_length(coalesce(last_name, '')) <= 80
    and char_length(coalesce(religion, '')) <= 40
    and char_length(coalesce(address, '')) <= 300
    and char_length(coalesce(email, '')) <= 254
    and char_length(coalesce(ol_results, '')) <= 1000
    and char_length(coalesce(al_results, '')) <= 1000
    and char_length(coalesce(special_needs, '')) <= 1000
  );
end;
$$;

-- full_name follows the first and last name whenever they are set.
create or replace function public.compose_student_full_name()
returns trigger
language plpgsql
as $$
begin
  new.first_name := nullif(btrim(regexp_replace(coalesce(new.first_name, ''), '\s+', ' ', 'g')), '');
  new.last_name := nullif(btrim(regexp_replace(coalesce(new.last_name, ''), '\s+', ' ', 'g')), '');
  if new.first_name is not null then
    new.full_name := btrim(new.first_name || ' ' || coalesce(new.last_name, ''));
  end if;
  return new;
end;
$$;

drop trigger if exists students_compose_full_name on public.students;
create trigger students_compose_full_name
before insert or update of first_name, last_name, full_name on public.students
for each row execute function public.compose_student_full_name();

-- Existing students: the last word is the last name, the rest the first.
update public.students
set first_name = case
      when btrim(full_name) ~ '\s' then regexp_replace(btrim(full_name), '\s+\S+$', '')
      else btrim(full_name)
    end,
    last_name = case
      when btrim(full_name) ~ '\s' then substring(btrim(full_name) from '(\S+)$')
      else null
    end
where first_name is null;

-- The NIC kept for the old exam forms moves to its own column.
update public.students
set nic = upper(regexp_replace(id_number, '\s', '', 'g'))
where nic is null
  and id_type = 'nic'
  and upper(regexp_replace(id_number, '\s', '', 'g')) ~ '^([0-9]{9}[VX]|[0-9]{12})$';

-- One active student per NIC in a class.
create unique index if not exists students_institute_nic_key
  on public.students (institute_id, nic)
  where nic is not null and status = 'active';

-- Every column a student record can carry, set from a JSON object of the same
-- names. Used by create_student and import_students so both write alike.
create or replace function public.student_from_json(p_institute uuid, p_data jsonb)
returns public.students
language plpgsql
stable
set search_path = public
as $$
declare
  s public.students;
  text_value text;
begin
  s.institute_id := p_institute;
  s.status := 'active';
  s.portal_enabled := false;
  s.first_name := nullif(btrim(p_data ->> 'first_name'), '');
  s.last_name := nullif(btrim(p_data ->> 'last_name'), '');
  s.full_name := btrim(coalesce(s.first_name, '') || ' ' || coalesce(s.last_name, ''));
  s.date_of_birth := nullif(p_data ->> 'date_of_birth', '')::date;
  s.gender := nullif(btrim(p_data ->> 'gender'), '');
  s.nic := nullif(upper(regexp_replace(coalesce(p_data ->> 'nic', ''), '\s', '', 'g')), '');
  s.religion := nullif(btrim(p_data ->> 'religion'), '');
  s.address := nullif(btrim(p_data ->> 'address'), '');
  s.phone := nullif(btrim(p_data ->> 'phone'), '');
  s.email := nullif(lower(btrim(p_data ->> 'email')), '');
  s.occupation := nullif(btrim(p_data ->> 'occupation'), '');
  s.qualification := nullif(btrim(p_data ->> 'qualification'), '');
  s.school := nullif(btrim(p_data ->> 'school'), '');
  s.medium := nullif(btrim(p_data ->> 'medium'), '');
  s.ol_results := nullif(btrim(p_data ->> 'ol_results'), '');
  s.al_results := nullif(btrim(p_data ->> 'al_results'), '');
  s.guardian_name := nullif(btrim(p_data ->> 'guardian_name'), '');
  s.guardian_phone := nullif(btrim(p_data ->> 'guardian_phone'), '');
  s.guardian_occupation := nullif(btrim(p_data ->> 'guardian_occupation'), '');
  s.father_name := nullif(btrim(p_data ->> 'father_name'), '');
  s.father_occupation := nullif(btrim(p_data ->> 'father_occupation'), '');
  s.mother_name := nullif(btrim(p_data ->> 'mother_name'), '');
  s.mother_occupation := nullif(btrim(p_data ->> 'mother_occupation'), '');
  s.emergency_contact_name := nullif(btrim(p_data ->> 'emergency_contact_name'), '');
  s.emergency_contact_phone := nullif(btrim(p_data ->> 'emergency_contact_phone'), '');
  s.learning_mode := nullif(btrim(p_data ->> 'learning_mode'), '');
  s.has_special_needs := coalesce((p_data ->> 'has_special_needs')::boolean, false);
  s.special_needs := case when s.has_special_needs then nullif(btrim(p_data ->> 'special_needs'), '') end;
  s.notes := nullif(btrim(p_data ->> 'notes'), '');
  return s;
end;
$$;

revoke all on function public.student_from_json(uuid, jsonb) from public, anon, authenticated;

create or replace function public.insert_student_row(s public.students)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if s.first_name is null then
    raise exception 'name required';
  end if;
  insert into public.students (
    institute_id, full_name, first_name, last_name, date_of_birth, gender, nic, religion,
    address, phone, email, occupation, qualification, school, medium, ol_results, al_results,
    guardian_name, guardian_phone, guardian_occupation, father_name, father_occupation,
    mother_name, mother_occupation, emergency_contact_name, emergency_contact_phone,
    learning_mode, has_special_needs, special_needs, notes, status, portal_enabled
  )
  values (
    s.institute_id, s.full_name, s.first_name, s.last_name, s.date_of_birth, s.gender, s.nic, s.religion,
    s.address, s.phone, s.email, s.occupation, s.qualification, s.school, s.medium, s.ol_results, s.al_results,
    s.guardian_name, s.guardian_phone, s.guardian_occupation, s.father_name, s.father_occupation,
    s.mother_name, s.mother_occupation, s.emergency_contact_name, s.emergency_contact_phone,
    s.learning_mode, s.has_special_needs, s.special_needs, s.notes, 'active', false
  )
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.insert_student_row(public.students) from public, anon, authenticated;

-- Add one student, on the given courses (none is fine). Returns their id.
create or replace function public.create_student(p_data jsonb, p_course_ids uuid[], p_start_date date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  institute uuid := public.current_institute_id();
  new_id uuid;
  course uuid;
begin
  if public.current_role() is distinct from 'admin' then
    raise exception 'not allowed';
  end if;
  new_id := public.insert_student_row(public.student_from_json(institute, p_data));
  foreach course in array coalesce(p_course_ids, '{}') loop
    if not exists (
      select 1 from public.courses c
      where c.id = course and c.institute_id = institute and c.archived_at is null
    ) then
      raise exception 'course not found';
    end if;
    insert into public.enrollments (institute_id, course_id, student_id, start_date)
    values (institute, course, new_id, coalesce(p_start_date, current_date))
    on conflict do nothing;
  end loop;
  return new_id;
end;
$$;

revoke all on function public.create_student(jsonb, uuid[], date) from public, anon;
grant execute on function public.create_student(jsonb, uuid[], date) to authenticated;

-- Bulk import, now with every field. Returns the new ids in row order.
create or replace function public.import_students(p_rows jsonb, p_start_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  institute uuid := public.current_institute_id();
  row_data jsonb;
  course_text text;
  new_student_id uuid;
  added integer := 0;
  ids jsonb := '[]'::jsonb;
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
    new_student_id := public.insert_student_row(public.student_from_json(institute, row_data));

    for course_text in
      select distinct value from jsonb_array_elements_text(coalesce(row_data -> 'course_ids', '[]'::jsonb))
    loop
      if not exists (
        select 1 from public.courses c
        where c.id = course_text::uuid and c.institute_id = institute and c.archived_at is null
      ) then
        raise exception 'course not found';
      end if;
      insert into public.enrollments (institute_id, course_id, student_id, start_date)
      values (institute, course_text::uuid, new_student_id, coalesce(p_start_date, current_date));
    end loop;

    added := added + 1;
    ids := ids || to_jsonb(new_student_id);
  end loop;

  insert into public.activity_log (institute_id, actor_profile_id, action, entity, data)
  values (institute, auth.uid(), 'students_imported', 'students', jsonb_build_object('count', added));

  return ids;
end;
$$;

revoke all on function public.import_students(jsonb, date) from public, anon;
grant execute on function public.import_students(jsonb, date) to authenticated;

-- The old one-course add; the app now uses create_student.
drop function if exists public.add_student_to_course(uuid, text, date, text, text, text, date);
