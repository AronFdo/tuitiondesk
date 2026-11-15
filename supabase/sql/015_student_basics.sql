-- TuitionDesk — date of birth and gender are taken when a student is added,
-- since every exam form needs them, and a student who leaves the class is
-- withdrawn from the exam entries for sittings not yet held, with the exam
-- payments on those entries voided. Nothing is deleted: entries and payments
-- stay as history, as everywhere else.
-- Run this in the Supabase SQL editor after 014_exam_catalogue.sql. Safe to re-run.

-- An earlier draft of this file deleted those entries and let their payments
-- and paperwork go with them. Put the keys back so nothing can be deleted
-- out from under an entry.
alter table public.exam_payments
  drop constraint if exists exam_payments_registration_id_fkey;
alter table public.exam_payments
  add constraint exam_payments_registration_id_fkey
  foreign key (registration_id) references public.exam_registrations (id) on delete restrict;

alter table public.student_documents
  drop constraint if exists student_documents_registration_id_fkey;
alter table public.student_documents
  add constraint student_documents_registration_id_fkey
  foreign key (registration_id) references public.exam_registrations (id) on delete restrict;

drop trigger if exists students_drop_entries_on_archive on public.students;
drop function if exists public.drop_entries_of_archived_student();

-- Runs as the definer so archiving a student always takes their entries with
-- it, whichever path archives them.
create or replace function public.withdraw_entries_of_archived_student()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Colombo')::date;
begin
  if new.status = 'archived' and old.status is distinct from 'archived' then
    update public.exam_payments payment
    set voided_at = now()
    from public.exam_registrations registration
    where payment.registration_id = registration.id
      and registration.student_id = new.id
      and registration.exam_date >= today
      and registration.status <> 'withdrawn'
      and payment.voided_at is null;

    update public.exam_registrations registration
    set status = 'withdrawn',
        withdrawn_at = now()
    where registration.student_id = new.id
      and registration.exam_date >= today
      and registration.status <> 'withdrawn';
  end if;
  return new;
end;
$$;

revoke all on function public.withdraw_entries_of_archived_student() from public, anon, authenticated;

drop trigger if exists students_withdraw_entries_on_archive on public.students;
create trigger students_withdraw_entries_on_archive
after update of status on public.students
for each row execute function public.withdraw_entries_of_archived_student();

-- Adding a student now takes their date of birth and gender.
drop function if exists public.add_student_to_course(uuid, text, text, text, date);

create or replace function public.add_student_to_course(
  p_course_id uuid,
  p_full_name text,
  p_date_of_birth date,
  p_gender text,
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
    date_of_birth,
    gender,
    guardian_name,
    guardian_phone,
    status,
    portal_enabled
  )
  values (
    course_institute_id,
    clean_name,
    p_date_of_birth,
    nullif(btrim(p_gender), ''),
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

revoke all on function public.add_student_to_course(uuid, text, date, text, text, text, date) from public, anon;
grant execute on function public.add_student_to_course(uuid, text, date, text, text, text, date) to authenticated;
