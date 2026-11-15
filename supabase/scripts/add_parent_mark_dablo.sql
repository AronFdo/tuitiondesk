-- Parent login for Mark Dablo, linked to the student Davis Dablo.
-- Paste the whole file into the Supabase SQL editor and run it.
-- Success prints: NOTICE: Linked Mark Dablo (...) to Davis Dablo (...)
-- Anything else is an error and nothing was saved; send it back.
-- Safe to re-run: an existing login, membership or link is reused.
do $$
declare
  parent_email    text := 'mark.dablo@example.com';  -- change if you like
  parent_password text := 'ChangeMe-2026!';          -- change if you like (8+ characters)
  parent_name     text := 'Mark Dablo';

  student_row    public.students%rowtype;
  student_count  int;
  parent_id      uuid;
  existing_role  text;
  crypto_schema  text;
  password_hash  text;
begin
  -- The student: exactly one active Davis Dablo.
  select count(*) into student_count
  from public.students
  where lower(btrim(full_name)) = 'davis dablo' and status = 'active';
  if student_count = 0 then
    raise exception 'No active student named Davis Dablo';
  elsif student_count > 1 then
    raise exception 'More than one active Davis Dablo; link by student id instead';
  end if;
  select * into student_row
  from public.students
  where lower(btrim(full_name)) = 'davis dablo' and status = 'active';

  -- pgcrypto lives in "extensions" on most projects, "public" on some.
  select n.nspname into crypto_schema
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.proname = 'gen_salt'
  order by (n.nspname = 'extensions') desc
  limit 1;
  if crypto_schema is null then
    raise exception 'pgcrypto is not installed; enable it under Database > Extensions';
  end if;
  execute format('select %I.crypt($1, %I.gen_salt(''bf''))', crypto_schema, crypto_schema)
    into password_hash
    using parent_password;

  -- The login: reuse it if that email already has one.
  select id into parent_id from auth.users where lower(email) = lower(parent_email);

  if parent_id is null then
    parent_id := gen_random_uuid();

    -- Token columns must be '' rather than NULL, or sign-in fails with
    -- "Database error querying schema".
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change_token_new, email_change_token_current, email_change,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', parent_id,
      'authenticated', 'authenticated', lower(parent_email), password_hash,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', parent_name),
      now(), now(),
      '', '',
      '', '', '',
      '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), parent_id, parent_id::text, 'email',
      jsonb_build_object('sub', parent_id::text, 'email', lower(parent_email), 'email_verified', true),
      now(), now(), now()
    );
  else
    -- Already there: make sure the password is the one above.
    update auth.users
    set encrypted_password = password_hash,
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = parent_id;
  end if;

  -- Profile, pointed at the student's class.
  insert into public.profiles (id, full_name, email, active_institute_id)
  values (parent_id, parent_name, lower(parent_email), student_row.institute_id)
  on conflict (id) do update
    set full_name = coalesce(public.profiles.full_name, excluded.full_name),
        active_institute_id = coalesce(public.profiles.active_institute_id, excluded.active_institute_id);

  -- Parent membership in that class. Refuse if this login is staff there.
  select m.role into existing_role
  from public.memberships m
  where m.profile_id = parent_id and m.institute_id = student_row.institute_id;
  if existing_role is not null and existing_role <> 'parent' then
    raise exception 'That email is already % in this class', existing_role;
  end if;
  if existing_role is null then
    insert into public.memberships (institute_id, profile_id, role)
    values (student_row.institute_id, parent_id, 'parent');
  end if;

  -- Link the parent to Davis.
  insert into public.guardian_links (institute_id, guardian_profile_id, student_id)
  values (student_row.institute_id, parent_id, student_row.id)
  on conflict (guardian_profile_id, student_id) do nothing;

  raise notice 'Linked % (%) to % (%)', parent_name, parent_id, student_row.full_name, student_row.id;
end $$;
