-- TuitionDesk — attach the existing login to a new Studypoint class.
-- Run this in the Supabase SQL editor after 003_courses.sql.
-- auth.users is not changed, and no password is set here.

do $$
declare
  owner_id uuid;
  new_institute_id uuid;
begin
  select id
  into owner_id
  from auth.users
  where email = 'aronfernando39@gmail.com';

  if owner_id is null then
    raise exception 'auth user not found';
  end if;

  insert into public.institutes (name)
  values ('Studypoint')
  returning id into new_institute_id;

  insert into public.profiles (id, full_name, email, active_institute_id)
  values (
    owner_id,
    'Aron Fernando',
    'aronfernando39@gmail.com',
    new_institute_id
  );

  insert into public.memberships (institute_id, profile_id, role)
  values (new_institute_id, owner_id, 'admin');
end $$;
