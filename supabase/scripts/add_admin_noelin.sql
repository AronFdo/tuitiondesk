-- Admin login for Noelin at Eunnis Center, on the staff list as Head Teacher.
-- Paste the whole file into the Supabase SQL editor and run it.
-- Success prints: NOTICE: Noelin (noelin@eunnis.com) is admin of Eunnis Center (...), Head Teacher
-- Anything else is an error and nothing was saved; send it back.
-- Safe to re-run: an existing login, membership or staff row is reused, and
-- the password is set to the one below again.
--
-- The password is in plain text here. Don't commit this file with it, and
-- ask Noelin to change it after her first sign-in.
do $$
declare
  admin_email    text := 'noelin@eunnis.com';
  admin_password text := 'ECOF@2026';
  admin_name     text := 'Noelin';
  staff_title    text := 'Head Teacher';
  institute_name text := 'Eunnis Center';

  institute_row   public.institutes%rowtype;
  institute_count int;
  admin_id        uuid;
  existing_role   text;
  crypto_schema   text;
  password_hash   text;
begin
  if char_length(admin_password) < 8 then
    raise exception 'The password needs at least 8 characters';
  end if;

  -- The class: exactly one called Eunnis Center.
  select count(*) into institute_count
  from public.institutes
  where lower(btrim(name)) = lower(institute_name);
  if institute_count = 0 then
    raise exception 'No class named %. Check the name under Settings > Class details', institute_name;
  elsif institute_count > 1 then
    raise exception 'More than one class named %; use the institute id instead', institute_name;
  end if;
  select * into institute_row
  from public.institutes
  where lower(btrim(name)) = lower(institute_name);

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
  -- bcrypt, the same hash Supabase Auth writes when a user picks a password.
  execute format('select %I.crypt($1, %I.gen_salt(''bf''))', crypto_schema, crypto_schema)
    into password_hash
    using admin_password;

  -- The login: reuse it if that email already has one.
  select id into admin_id from auth.users where lower(email) = lower(admin_email);

  if admin_id is null then
    admin_id := gen_random_uuid();

    -- Token columns must be '' rather than NULL, or sign-in fails with
    -- "Database error querying schema". No institute_name in the metadata,
    -- so the sign-up trigger does not create a second class.
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change_token_new, email_change_token_current, email_change,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', admin_id,
      'authenticated', 'authenticated', lower(admin_email), password_hash,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', admin_name),
      now(), now(),
      '', '',
      '', '', '',
      '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), admin_id, admin_id::text, 'email',
      jsonb_build_object('sub', admin_id::text, 'email', lower(admin_email), 'email_verified', true),
      now(), now(), now()
    );
  else
    -- Already there: make sure the password is the one above.
    update auth.users
    set encrypted_password = password_hash,
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = admin_id;
  end if;

  -- Profile, opening Eunnis Center when she signs in.
  insert into public.profiles (id, full_name, email, active_institute_id)
  values (admin_id, admin_name, lower(admin_email), institute_row.id)
  on conflict (id) do update
    set full_name = coalesce(nullif(btrim(public.profiles.full_name), ''), excluded.full_name),
        email = excluded.email,
        active_institute_id = excluded.active_institute_id;

  -- Admin of Eunnis Center. A teacher login there is promoted; a parent or
  -- student login is refused, since one email cannot be both.
  select m.role into existing_role
  from public.memberships m
  where m.profile_id = admin_id and m.institute_id = institute_row.id;
  if existing_role in ('parent', 'student') then
    raise exception 'That email is already a % login in this class; use a different email for staff', existing_role;
  end if;
  if existing_role is null then
    insert into public.memberships (institute_id, profile_id, role)
    values (institute_row.id, admin_id, 'admin');
  elsif existing_role = 'teacher' then
    update public.memberships set role = 'admin'
    where profile_id = admin_id and institute_id = institute_row.id;
  end if;

  -- Staff directory row (028_staff.sql), titled Head Teacher. The membership
  -- trigger adds one for a new membership; this covers re-runs and older rows.
  if to_regclass('public.staff_members') is not null then
    update public.staff_members
    set title = staff_title,
        full_name = case when full_name in (lower(admin_email), 'Staff member') then admin_name else full_name end,
        email = coalesce(email, lower(admin_email))
    where institute_id = institute_row.id and profile_id = admin_id;
    if not found then
      insert into public.staff_members (institute_id, profile_id, full_name, email, title)
      values (institute_row.id, admin_id, admin_name, lower(admin_email), staff_title);
    end if;
  end if;

  raise notice '% (%) is admin of % (%), %',
    admin_name, lower(admin_email), institute_row.name, institute_row.id, staff_title;
end $$;
