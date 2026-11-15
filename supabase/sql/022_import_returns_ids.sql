-- TuitionDesk — the bulk import now returns the new students' ids, in the
-- order of the rows sent, so photos chosen with the CSV can be attached to the
-- right student straight after. Nothing else about the import changes.
-- Run this in the Supabase SQL editor after 021_receipts.sql. Safe to re-run.

-- The return type changes, so the old function has to go first.
drop function if exists public.import_students(jsonb, date);

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
  clean_name text;
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
    ids := ids || to_jsonb(new_student_id);
  end loop;

  insert into public.activity_log (institute_id, actor_profile_id, action, entity, data)
  values (institute, auth.uid(), 'students_imported', 'students', jsonb_build_object('count', added));

  return ids;
end;
$$;

revoke all on function public.import_students(jsonb, date) from public, anon;
grant execute on function public.import_students(jsonb, date) to authenticated;
