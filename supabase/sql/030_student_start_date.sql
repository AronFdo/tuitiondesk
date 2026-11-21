-- TuitionDesk — the date each student started at the institute.
-- Separate from each course's enrolment start date, which fees are counted
-- from: backdating when a student joined never creates arrears.
-- * Existing students get their earliest course start, or the day they were
--   added when they have no courses.
-- * New students default to today (Colombo) when no date is given.
-- * Changes show in the student's History tab (025 logs every column).
-- Run this in the Supabase SQL editor after 029_staff_roles.sql. Safe to re-run.

alter table public.students
  add column if not exists start_date date;

update public.students s
set start_date = least(
  (s.created_at at time zone 'Asia/Colombo')::date,
  coalesce(
    (select min(e.start_date) from public.enrollments e where e.student_id = s.id),
    (s.created_at at time zone 'Asia/Colombo')::date
  )
)
where s.start_date is null;

alter table public.students
  alter column start_date set default (now() at time zone 'Asia/Colombo')::date,
  alter column start_date set not null;

do $$
begin
  alter table public.students drop constraint if exists students_start_date_check;
  alter table public.students add constraint students_start_date_check
    check (start_date >= date '1900-01-01');
end;
$$;

-- As in 023, plus start_date.
create or replace function public.student_from_json(p_institute uuid, p_data jsonb)
returns public.students
language plpgsql
stable
set search_path = public
as $$
declare
  s public.students;
begin
  s.institute_id := p_institute;
  s.status := 'active';
  s.portal_enabled := false;
  s.first_name := nullif(btrim(p_data ->> 'first_name'), '');
  s.last_name := nullif(btrim(p_data ->> 'last_name'), '');
  s.full_name := btrim(coalesce(s.first_name, '') || ' ' || coalesce(s.last_name, ''));
  s.date_of_birth := nullif(p_data ->> 'date_of_birth', '')::date;
  s.start_date := coalesce(
    nullif(p_data ->> 'start_date', '')::date,
    (now() at time zone 'Asia/Colombo')::date
  );
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
    institute_id, full_name, first_name, last_name, date_of_birth, start_date, gender, nic, religion,
    address, phone, email, occupation, qualification, school, medium, ol_results, al_results,
    guardian_name, guardian_phone, guardian_occupation, father_name, father_occupation,
    mother_name, mother_occupation, emergency_contact_name, emergency_contact_phone,
    learning_mode, has_special_needs, special_needs, notes, status, portal_enabled
  )
  values (
    s.institute_id, s.full_name, s.first_name, s.last_name, s.date_of_birth,
    coalesce(s.start_date, (now() at time zone 'Asia/Colombo')::date), s.gender, s.nic, s.religion,
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
