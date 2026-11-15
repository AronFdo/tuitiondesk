-- TuitionDesk — the staff directory.
-- One staff_members row per person who works at the institute: teachers,
-- front desk, anyone. profile_id links the row to a login (an admin or
-- teacher membership); it is null for staff who never sign in. Existing
-- admins and teachers are added here so the directory starts complete.
--
-- Only staff with staff.manage (admins) can read or change the directory.
-- Archiving someone ends their login access to this institute and takes them
-- off the courses they taught, so a former teacher cannot keep signing in.
-- Run this in the Supabase SQL editor after 027_course_history.sql. Safe to re-run.

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete restrict,
  profile_id uuid references public.profiles (id) on delete set null,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  title text check (title is null or char_length(title) <= 80),
  phone text check (phone is null or phone ~ '^\+[1-9]\d{6,14}$'),
  email text check (email is null or char_length(email) <= 254),
  nic text check (nic is null or nic ~ '^(\d{9}[VX]|\d{12})$'),
  address text check (address is null or char_length(address) <= 300),
  subjects text check (subjects is null or char_length(subjects) <= 300),
  joined_on date,
  left_on date,
  notes text check (notes is null or char_length(notes) <= 2000),
  status text not null default 'active' check (status in ('active', 'archived')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (left_on is null or joined_on is null or left_on >= joined_on)
);

create unique index if not exists staff_members_profile
on public.staff_members (institute_id, profile_id)
where profile_id is not null;

create index if not exists staff_members_institute
on public.staff_members (institute_id, status, full_name);

drop trigger if exists staff_members_set_updated_at on public.staff_members;
create trigger staff_members_set_updated_at
before update on public.staff_members
for each row execute function public.set_updated_at();

-- Everyone who already signs in as staff.
insert into public.staff_members (institute_id, profile_id, full_name, email, title)
select
  m.institute_id,
  m.profile_id,
  coalesce(nullif(btrim(p.full_name), ''), p.email, 'Staff member'),
  p.email,
  case m.role when 'admin' then 'Owner' else 'Teacher' end
from public.memberships m
join public.profiles p on p.id = m.profile_id
where m.role in ('admin', 'teacher')
  and not exists (
    select 1 from public.staff_members s
    where s.institute_id = m.institute_id and s.profile_id = m.profile_id
  );

alter table public.staff_members enable row level security;
revoke all on public.staff_members from anon;
grant select, insert, update on public.staff_members to authenticated;
grant all on public.staff_members to service_role;

drop policy if exists staff_members_select on public.staff_members;
create policy staff_members_select on public.staff_members
for select to authenticated
using (institute_id = public.current_institute_id() and public.has_permission('staff.manage'));

drop policy if exists staff_members_insert on public.staff_members;
create policy staff_members_insert on public.staff_members
for insert to authenticated
with check (institute_id = public.current_institute_id() and public.has_permission('staff.manage'));

-- profile_id and status change only through the functions below.
drop policy if exists staff_members_update on public.staff_members;
create policy staff_members_update on public.staff_members
for update to authenticated
using (institute_id = public.current_institute_id() and public.has_permission('staff.manage'))
with check (institute_id = public.current_institute_id() and public.has_permission('staff.manage'));

revoke update on public.staff_members from authenticated;
grant update (
  full_name, title, phone, email, nic, address, subjects, joined_on, left_on, notes
) on public.staff_members to authenticated;

-- Link a staff row to a login and give it teacher access. Called by the app
-- after it has found or invited the account (that part needs the service
-- key). An admin login is kept as admin.
create or replace function public.grant_staff_login(p_staff_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  institute uuid := public.current_institute_id();
  existing_role text;
begin
  if not public.has_permission('staff.manage') then
    raise exception 'not allowed';
  end if;
  if not exists (
    select 1 from public.staff_members s
    where s.id = p_staff_id and s.institute_id = institute and s.status = 'active'
  ) then
    raise exception 'staff not found';
  end if;
  if exists (
    select 1 from public.staff_members s
    where s.institute_id = institute and s.profile_id = p_profile_id and s.id <> p_staff_id
  ) then
    raise exception 'login already linked';
  end if;

  select m.role into existing_role
  from public.memberships m
  where m.profile_id = p_profile_id and m.institute_id = institute;
  if existing_role in ('parent', 'student') then
    raise exception 'login is a family account';
  end if;
  -- Link first, so the membership trigger below finds this row instead of
  -- adding a second one.
  update public.staff_members set profile_id = p_profile_id where id = p_staff_id;
  if existing_role is null then
    insert into public.memberships (institute_id, profile_id, role)
    values (institute, p_profile_id, 'teacher');
  end if;
end;
$$;

revoke all on function public.grant_staff_login(uuid, uuid) from public, anon;
grant execute on function public.grant_staff_login(uuid, uuid) to authenticated;

-- End someone's work here: archived, their login access to this institute
-- removed, and their courses left without a teacher. Nobody can archive
-- themselves, so an institute always keeps the admin doing this.
create or replace function public.archive_staff_member(p_staff_id uuid, p_left_on date default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  institute uuid := public.current_institute_id();
  member public.staff_members;
begin
  if not public.has_permission('staff.manage') then
    raise exception 'not allowed';
  end if;
  select * into member from public.staff_members
  where id = p_staff_id and institute_id = institute and status = 'active';
  if not found then
    raise exception 'staff not found';
  end if;
  if member.profile_id = auth.uid() then
    raise exception 'cannot archive yourself';
  end if;

  if member.profile_id is not null then
    update public.courses set teacher_profile_id = null
    where institute_id = institute and teacher_profile_id = member.profile_id;
    delete from public.memberships
    where institute_id = institute
      and profile_id = member.profile_id
      and role in ('admin', 'teacher');
  end if;

  update public.staff_members
  set status = 'archived',
      archived_at = now(),
      left_on = coalesce(p_left_on, left_on, (now() at time zone 'Asia/Colombo')::date),
      profile_id = null
  where id = p_staff_id;
end;
$$;

revoke all on function public.archive_staff_member(uuid, date) from public, anon;
grant execute on function public.archive_staff_member(uuid, date) to authenticated;

-- Back on the directory. Login access is given again separately.
create or replace function public.restore_staff_member(p_staff_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('staff.manage') then
    raise exception 'not allowed';
  end if;
  update public.staff_members
  set status = 'active', archived_at = null, left_on = null
  where id = p_staff_id
    and institute_id = public.current_institute_id()
    and status = 'archived';
  if not found then
    raise exception 'staff not found';
  end if;
end;
$$;

revoke all on function public.restore_staff_member(uuid) from public, anon;
grant execute on function public.restore_staff_member(uuid) to authenticated;

-- Make this staff member the teacher of exactly these courses. Courses they
-- taught that are not in the list are left without a teacher.
create or replace function public.set_staff_courses(p_staff_id uuid, p_course_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  institute uuid := public.current_institute_id();
  teacher uuid;
begin
  if not public.has_permission('staff.manage') then
    raise exception 'not allowed';
  end if;
  select profile_id into teacher from public.staff_members
  where id = p_staff_id and institute_id = institute and status = 'active';
  if teacher is null then
    raise exception 'staff has no login';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_course_ids, '{}')) as w (id)
    where not exists (
      select 1 from public.courses c
      where c.id = w.id and c.institute_id = institute and c.archived_at is null
    )
  ) then
    raise exception 'course not found';
  end if;

  update public.courses set teacher_profile_id = null
  where institute_id = institute
    and teacher_profile_id = teacher
    and archived_at is null
    and not (id = any (coalesce(p_course_ids, '{}')));
  update public.courses set teacher_profile_id = teacher
  where institute_id = institute
    and id = any (coalesce(p_course_ids, '{}'));
end;
$$;

revoke all on function public.set_staff_courses(uuid, uuid[]) from public, anon;
grant execute on function public.set_staff_courses(uuid, uuid[]) to authenticated;

-- New logins from a teacher invite get a directory row too, so nobody with
-- access is missing from it. Runs when the membership is created.
create or replace function public.add_staff_for_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role in ('admin', 'teacher') and not exists (
    select 1 from public.staff_members s
    where s.institute_id = new.institute_id and s.profile_id = new.profile_id
  ) then
    insert into public.staff_members (institute_id, profile_id, full_name, email, title)
    select new.institute_id, new.profile_id,
      coalesce(nullif(btrim(p.full_name), ''), p.email, 'Staff member'),
      p.email,
      case new.role when 'admin' then 'Owner' else 'Teacher' end
    from public.profiles p
    where p.id = new.profile_id;
  end if;
  return new;
end;
$$;

revoke all on function public.add_staff_for_membership() from public, anon, authenticated;

drop trigger if exists memberships_add_staff on public.memberships;
create trigger memberships_add_staff
after insert on public.memberships
for each row execute function public.add_staff_for_membership();
