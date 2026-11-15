-- TuitionDesk — admins can make other staff admins.
-- * grant_staff_login (028) takes the role to give a new login: teacher or
--   admin. A login that already has a role here keeps it.
-- * set_staff_role switches an existing login between teacher and admin.
-- Nobody changes their own role, so the admin doing this always stays one
-- and an institute is never left without an admin.
-- Run this in the Supabase SQL editor after 028_staff.sql. Safe to re-run.

drop function if exists public.grant_staff_login(uuid, uuid);

create or replace function public.grant_staff_login(
  p_staff_id uuid,
  p_profile_id uuid,
  p_role text default 'teacher'
)
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
  if p_role not in ('admin', 'teacher') then
    raise exception 'bad role';
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

  -- Link first, so the membership trigger (028) finds this row instead of
  -- adding a second one.
  update public.staff_members set profile_id = p_profile_id where id = p_staff_id;
  if existing_role is null then
    insert into public.memberships (institute_id, profile_id, role)
    values (institute, p_profile_id, p_role);
  end if;
end;
$$;

revoke all on function public.grant_staff_login(uuid, uuid, text) from public, anon;
grant execute on function public.grant_staff_login(uuid, uuid, text) to authenticated;

create or replace function public.set_staff_role(p_staff_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  institute uuid := public.current_institute_id();
  member_profile uuid;
begin
  if not public.has_permission('staff.manage') then
    raise exception 'not allowed';
  end if;
  if p_role not in ('admin', 'teacher') then
    raise exception 'bad role';
  end if;
  select s.profile_id into member_profile
  from public.staff_members s
  where s.id = p_staff_id and s.institute_id = institute and s.status = 'active';
  if member_profile is null then
    raise exception 'staff has no login';
  end if;
  if member_profile = auth.uid() then
    raise exception 'cannot change your own role';
  end if;

  update public.memberships
  set role = p_role
  where institute_id = institute
    and profile_id = member_profile
    and role in ('admin', 'teacher');
  if not found then
    raise exception 'staff has no login';
  end if;
end;
$$;

revoke all on function public.set_staff_role(uuid, text) from public, anon;
grant execute on function public.set_staff_role(uuid, text) to authenticated;
