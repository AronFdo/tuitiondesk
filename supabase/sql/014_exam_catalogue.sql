-- TuitionDesk — the British Council Cambridge English calendar and fee list,
-- shared by every institute, so a session is picked rather than typed in.
-- A course is one exam; it keeps its own copy of this year's sitting, so a
-- later calendar change never moves an institute's sitting without it knowing.
-- Entries gain the REX reference staff get when they register a candidate on
-- the British Council system.
-- There is no exams table: the exam lives on the course (003_courses.sql).
-- Run this in the Supabase SQL editor after 013_exam_registrations.sql. Safe to re-run.
--
-- Sources (assets/): cela_2026_v7.pdf and
-- cambridge_english_qualifications_fees_aug_2026_to_july_2027_public.pdf.
-- TKT is left out: it is for teachers, not students.
-- Each new calendar or fee list goes in a new file (0NN_exam_calendar_YYYY.sql)
-- with the same upserts; a corrected PDF can be loaded over these rows.

create table if not exists public.exam_catalogue_fees (
  id uuid primary key default gen_random_uuid(),
  board text not null check (board in ('cambridge_english')),
  level text not null,
  -- Sessions held between these dates pay these fees.
  valid_from date not null,
  valid_to date not null,
  fee_minor integer not null check (fee_minor >= 0),
  late_fee_minor integer not null check (late_fee_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board, level, valid_from),
  check (valid_to >= valid_from)
);

create table if not exists public.exam_catalogue_sessions (
  id uuid primary key default gen_random_uuid(),
  board text not null check (board in ('cambridge_english')),
  level text not null,
  format text not null check (format in ('paper', 'digital')),
  location text not null,
  exam_date date not null,
  speaking_from date,
  speaking_to date,
  registration_opens_on date not null,
  registration_closes_on date not null,
  late_closes_on date not null,
  source text not null,
  -- Set if the British Council drops a session.
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board, level, format, location, exam_date)
);

drop trigger if exists exam_catalogue_fees_set_updated_at on public.exam_catalogue_fees;
create trigger exam_catalogue_fees_set_updated_at
before update on public.exam_catalogue_fees
for each row execute function public.set_updated_at();

drop trigger if exists exam_catalogue_sessions_set_updated_at on public.exam_catalogue_sessions;
create trigger exam_catalogue_sessions_set_updated_at
before update on public.exam_catalogue_sessions
for each row execute function public.set_updated_at();

-- Readable by anyone signed in; only the SQL editor (service role) writes.
alter table public.exam_catalogue_fees enable row level security;
alter table public.exam_catalogue_sessions enable row level security;

revoke all on public.exam_catalogue_fees from anon, authenticated;
revoke all on public.exam_catalogue_sessions from anon, authenticated;
grant select on public.exam_catalogue_fees to authenticated;
grant select on public.exam_catalogue_sessions to authenticated;
grant all on public.exam_catalogue_fees to service_role;
grant all on public.exam_catalogue_sessions to service_role;

drop policy if exists exam_catalogue_fees_select on public.exam_catalogue_fees;
create policy exam_catalogue_fees_select on public.exam_catalogue_fees
for select to authenticated
using (true);

drop policy if exists exam_catalogue_sessions_select on public.exam_catalogue_sessions;
create policy exam_catalogue_sessions_select on public.exam_catalogue_sessions
for select to authenticated
using (true);

-- The calendar session a course's current sitting was taken from, if any.
alter table public.courses
  add column if not exists catalogue_session_id uuid
    references public.exam_catalogue_sessions (id) on delete set null;

-- Entries belong to a course's sitting (course_id, exam_date).
alter table public.exam_registrations
  add column if not exists rex_reference text;

create unique index if not exists exam_registrations_rex_reference_idx
  on public.exam_registrations (course_id, exam_date, rex_reference)
  where rex_reference is not null;

-- Fees for test sessions from 1 August 2026 to 31 July 2027, in cents.
-- For Schools levels pay the same as their main level.
insert into public.exam_catalogue_fees
  (board, level, valid_from, valid_to, fee_minor, late_fee_minor)
values
  ('cambridge_english', 'pre_a1_starters',        '2026-08-01', '2027-07-31', 1670000, 2087500),
  ('cambridge_english', 'a1_movers',              '2026-08-01', '2027-07-31', 1700000, 2125000),
  ('cambridge_english', 'a2_flyers',              '2026-08-01', '2027-07-31', 1730000, 2162500),
  ('cambridge_english', 'a2_key',                 '2026-08-01', '2027-07-31', 2130000, 2662500),
  ('cambridge_english', 'a2_key_schools',         '2026-08-01', '2027-07-31', 2130000, 2662500),
  ('cambridge_english', 'b1_preliminary',         '2026-08-01', '2027-07-31', 2680000, 3350000),
  ('cambridge_english', 'b1_preliminary_schools', '2026-08-01', '2027-07-31', 2680000, 3350000),
  ('cambridge_english', 'b2_first',               '2026-08-01', '2027-07-31', 3610000, 4512500),
  ('cambridge_english', 'b2_first_schools',       '2026-08-01', '2027-07-31', 3610000, 4512500),
  ('cambridge_english', 'c1_advanced',            '2026-08-01', '2027-07-31', 4690000, 5862500),
  ('cambridge_english', 'c2_proficiency',         '2026-08-01', '2027-07-31', 4890000, 6112500)
on conflict (board, level, valid_from) do update
set
  valid_to = excluded.valid_to,
  fee_minor = excluded.fee_minor,
  late_fee_minor = excluded.late_fee_minor;

-- The 2026 calendar. Levels that sit together share a row here and are
-- expanded to one session per level.
insert into public.exam_catalogue_sessions
  (board, level, format, location, exam_date, speaking_from, speaking_to,
   registration_opens_on, registration_closes_on, late_closes_on, source)
select
  'cambridge_english', level, calendar.format, calendar.location,
  calendar.exam_date::date, calendar.speaking_from::date, calendar.speaking_to::date,
  calendar.opens::date, calendar.closes::date, calendar.late::date, 'cela_2026_v7'
from (
  values
    -- Pre A1 Starters, A1 Movers, A2 Flyers (paper)
    (array['pre_a1_starters', 'a1_movers', 'a2_flyers'], 'paper', 'Anuradhapura', '2026-08-01', null, null, '2026-06-01', '2026-06-15', '2026-06-22'),
    (array['pre_a1_starters', 'a1_movers', 'a2_flyers'], 'paper', 'Colombo',      '2026-09-12', null, null, '2026-07-01', '2026-07-15', '2026-07-22'),
    (array['pre_a1_starters', 'a1_movers', 'a2_flyers'], 'paper', 'Galle',        '2026-09-19', null, null, '2026-07-01', '2026-07-15', '2026-07-22'),
    (array['pre_a1_starters', 'a1_movers', 'a2_flyers'], 'paper', 'Kandy',        '2026-09-19', null, null, '2026-07-01', '2026-07-15', '2026-07-22'),
    (array['pre_a1_starters', 'a1_movers', 'a2_flyers'], 'paper', 'Colombo',      '2026-09-26', null, null, '2026-07-01', '2026-07-15', '2026-07-22'),
    (array['pre_a1_starters', 'a1_movers', 'a2_flyers'], 'paper', 'Kuliyapitiya', '2026-10-24', null, null, '2026-08-01', '2026-08-15', '2026-08-22'),
    (array['pre_a1_starters', 'a1_movers', 'a2_flyers'], 'paper', 'Colombo',      '2026-10-31', null, null, '2026-08-01', '2026-08-15', '2026-08-22'),
    (array['pre_a1_starters', 'a1_movers', 'a2_flyers'], 'paper', 'Colombo',      '2026-11-07', null, null, '2026-09-01', '2026-09-15', '2026-09-22'),
    (array['pre_a1_starters', 'a1_movers', 'a2_flyers'], 'paper', 'Galle',        '2026-11-14', null, null, '2026-09-01', '2026-09-15', '2026-09-22'),
    (array['pre_a1_starters', 'a1_movers', 'a2_flyers'], 'paper', 'Colombo',      '2026-11-28', null, null, '2026-09-01', '2026-09-15', '2026-09-22'),
    (array['pre_a1_starters', 'a1_movers', 'a2_flyers'], 'paper', 'Kandy',        '2026-11-28', null, null, '2026-09-01', '2026-09-15', '2026-09-22'),
    (array['pre_a1_starters', 'a1_movers', 'a2_flyers'], 'paper', 'Negombo',      '2026-12-12', null, null, '2026-10-01', '2026-10-15', '2026-10-22'),
    (array['pre_a1_starters', 'a1_movers', 'a2_flyers'], 'paper', 'Badulla',      '2026-12-19', null, null, '2026-10-01', '2026-10-15', '2026-10-22'),
    -- A2 Key and B1 Preliminary (paper)
    (array['a2_key', 'b1_preliminary'], 'paper', 'Colombo', '2026-12-03', '2026-11-27', '2026-12-06', '2026-10-01', '2026-10-15', '2026-10-22'),
    (array['a2_key', 'b1_preliminary'], 'paper', 'Kandy',   '2026-12-03', '2026-11-27', '2026-12-06', '2026-10-01', '2026-10-15', '2026-10-22'),
    -- A2 Key for Schools and B1 Preliminary for Schools (paper)
    (array['a2_key_schools', 'b1_preliminary_schools'], 'paper', 'Anuradhapura', '2026-08-02', '2026-07-25', '2026-08-03', '2026-06-01', '2026-06-16', '2026-06-23'),
    (array['a2_key_schools', 'b1_preliminary_schools'], 'paper', 'Galle',        '2026-09-20', '2026-09-12', '2026-09-21', '2026-07-01', '2026-07-15', '2026-07-22'),
    (array['a2_key_schools', 'b1_preliminary_schools'], 'paper', 'Kuliyapitiya', '2026-10-25', '2026-10-17', '2026-10-26', '2026-08-01', '2026-08-15', '2026-08-22'),
    (array['a2_key_schools', 'b1_preliminary_schools'], 'paper', 'Ambalangoda',  '2026-11-15', '2026-11-07', '2026-11-16', '2026-09-01', '2026-09-15', '2026-09-22'),
    (array['a2_key_schools', 'b1_preliminary_schools'], 'paper', 'Colombo',      '2026-11-21', '2026-11-14', '2026-11-23', '2026-09-01', '2026-09-15', '2026-09-22'),
    (array['a2_key_schools', 'b1_preliminary_schools'], 'paper', 'Kandy',        '2026-11-21', '2026-11-14', '2026-11-23', '2026-09-01', '2026-09-15', '2026-09-22'),
    (array['a2_key_schools', 'b1_preliminary_schools'], 'paper', 'Negombo',      '2026-12-13', '2026-12-05', '2026-12-14', '2026-10-01', '2026-10-15', '2026-10-22'),
    (array['a2_key_schools', 'b1_preliminary_schools'], 'paper', 'Badulla',      '2026-12-20', '2026-12-12', '2026-12-21', '2026-10-01', '2026-10-15', '2026-10-22'),
    -- B2 First for Schools, C2 Proficiency, B2 First (paper)
    (array['b2_first_schools'], 'paper', 'Colombo', '2026-12-05', '2026-11-27', '2026-12-06', '2026-10-01', '2026-10-15', '2026-10-22'),
    (array['c2_proficiency'],   'paper', 'Colombo', '2026-12-12', '2026-12-04', '2026-12-13', '2026-10-01', '2026-10-15', '2026-10-22'),
    (array['b2_first'],         'paper', 'Colombo', '2026-11-24', '2026-11-20', '2026-11-29', '2026-09-01', '2026-09-17', '2026-09-22'),
    -- C1 Advanced (computer based)
    (array['c1_advanced'], 'digital', 'Colombo', '2026-12-05', '2026-11-28', '2026-12-07', '2026-10-01', '2026-10-15', '2026-10-22')
) as calendar (levels, format, location, exam_date, speaking_from, speaking_to, opens, closes, late)
cross join lateral unnest(calendar.levels) as level
on conflict (board, level, format, location, exam_date) do update
set
  speaking_from = excluded.speaking_from,
  speaking_to = excluded.speaking_to,
  registration_opens_on = excluded.registration_opens_on,
  registration_closes_on = excluded.registration_closes_on,
  late_closes_on = excluded.late_closes_on,
  source = excluded.source,
  withdrawn_at = null;
