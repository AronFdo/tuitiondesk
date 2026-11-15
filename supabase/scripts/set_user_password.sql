-- Set a new password for any TuitionDesk login (class owner, teacher or parent).
--
-- 1. Copy this whole file into the Supabase SQL editor (Dashboard > SQL Editor).
-- 2. In the editor, replace the two values below. Do not save the real
--    password into this file: it would sit in the project in plain text.
-- 3. Run it. Success prints:
--      NOTICE: Password changed for owner@example.com (admin of My Class). Signed out of 2 sessions.
--    Anything else is an error and nothing was changed.
--
-- The user is signed out everywhere, so the old password stops working at
-- once; they sign in again with the new one. Safe to run again.
do $$
declare
  user_email   text := 'aronfernando39@gmail.com';          -- the login email
  new_password text := 'Adfsjc2002';   -- 8 or more characters

  target_id      uuid;
  crypto_schema  text;
  password_hash  text;
  roles          text;
  ended_sessions int := 0;
begin
  if user_email like 'PUT-THE-%' or new_password like 'PUT-THE-%' then
    raise exception 'Replace the email and the new password at the top of the script first';
  end if;
  if char_length(new_password) < 8 then
    raise exception 'The new password needs at least 8 characters';
  end if;

  select id into target_id from auth.users where lower(email) = lower(btrim(user_email));
  if target_id is null then
    raise exception 'No login with the email %. Check the spelling, or look under Authentication > Users', user_email;
  end if;

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
    using new_password;

  update auth.users
  set encrypted_password = password_hash,
      -- A sign-up that was never confirmed could not log in with any password.
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
  where id = target_id;

  -- Sign out every device. Refresh tokens belong to sessions and go with them.
  delete from auth.sessions where user_id = target_id;
  get diagnostics ended_sessions = row_count;

  select string_agg(m.role || ' of ' || i.name, ', ' order by i.name)
  into roles
  from public.memberships m
  join public.institutes i on i.id = m.institute_id
  where m.profile_id = target_id;

  raise notice 'Password changed for % (%). Signed out of % session%.',
    lower(btrim(user_email)),
    coalesce(roles, 'no class membership'),
    ended_sessions,
    case when ended_sessions = 1 then '' else 's' end;
end;
$$;
