-- TuitionDesk Phase 1 — tables, sign-up trigger, and row level security.
-- Run this once in the Supabase SQL editor, before 002_institute_logos.sql.
-- Safe to re-run: tables are created only if missing; policies and triggers are replaced.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

create table if not exists public.institutes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  logo_path text,
  timezone text not null default 'Asia/Colombo',
  tuition_due_day smallint check (tuition_due_day is null or tuition_due_day between 1 and 31),
  exam_due_day smallint check (exam_due_day is null or exam_due_day between 1 and 31),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  email text,
  active_institute_id uuid references public.institutes (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete restrict,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('admin', 'teacher', 'student', 'parent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institute_id, profile_id)
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete restrict,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists institutes_set_updated_at on public.institutes;
create trigger institutes_set_updated_at
before update on public.institutes
for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists memberships_set_updated_at on public.memberships;
create trigger memberships_set_updated_at
before update on public.memberships
for each row execute function public.set_updated_at();

drop trigger if exists activity_log_set_updated_at on public.activity_log;
create trigger activity_log_set_updated_at
before update on public.activity_log
for each row execute function public.set_updated_at();

-- Active institute comes from the profile row, and only counts when a staff
-- membership for that institute still exists. Security definer avoids RLS loops.
create or replace function public.current_institute_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.active_institute_id
  from public.profiles p
  where p.id = auth.uid()
    and exists (
      select 1
      from public.memberships m
      where m.profile_id = p.id
        and m.institute_id = p.active_institute_id
        and m.role in ('admin', 'teacher', 'parent')
    );
$$;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from public.memberships m
  where m.profile_id = auth.uid()
    and m.institute_id = public.current_institute_id();
$$;

revoke all on function public.current_institute_id() from public, anon;
revoke all on function public.current_role() from public, anon;
grant execute on function public.current_institute_id() to authenticated;
grant execute on function public.current_role() to authenticated;

-- Sign-up metadata institute_name creates the institute, profile, and admin
-- membership in this same transaction. Teacher invites omit institute_name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_institute_id uuid;
  institute_name text;
begin
  institute_name := nullif(btrim(new.raw_user_meta_data->>'institute_name'), '');
  if institute_name is null then
    return new;
  end if;

  insert into public.institutes (name)
  values (institute_name)
  returning id into new_institute_id;

  insert into public.profiles (id, full_name, email, active_institute_id)
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
    new.email,
    new_institute_id
  );

  insert into public.memberships (institute_id, profile_id, role)
  values (new_institute_id, new.id, 'admin');

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.institutes enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.activity_log enable row level security;

grant select, insert, update, delete on public.institutes to authenticated, service_role;
grant select, insert, delete on public.profiles to authenticated, service_role;
grant update (full_name, phone, email) on public.profiles to authenticated;
grant update on public.profiles to service_role;
grant select, insert, update, delete on public.memberships to authenticated, service_role;
grant select, insert, update, delete on public.activity_log to authenticated, service_role;

revoke all on public.institutes from anon;
revoke all on public.profiles from anon;
revoke all on public.memberships from anon;
revoke all on public.activity_log from anon;

drop policy if exists institutes_select on public.institutes;
create policy institutes_select on public.institutes
for select to authenticated
using (id = public.current_institute_id());

drop policy if exists institutes_update_admin on public.institutes;
create policy institutes_update_admin on public.institutes
for update to authenticated
using (id = public.current_institute_id() and public.current_role() = 'admin')
with check (id = public.current_institute_id() and public.current_role() = 'admin');

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or (
    public.current_role() = 'admin'
    and exists (
      select 1
      from public.memberships m
      where m.profile_id = profiles.id
        and m.institute_id = public.current_institute_id()
    )
  )
);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships
for select to authenticated
using (
  institute_id = public.current_institute_id()
  and (
    public.current_role() = 'admin'
    or profile_id = auth.uid()
  )
);

drop policy if exists activity_log_admin on public.activity_log;
create policy activity_log_admin on public.activity_log
for all to authenticated
using (institute_id = public.current_institute_id() and public.current_role() = 'admin')
with check (institute_id = public.current_institute_id() and public.current_role() = 'admin');
