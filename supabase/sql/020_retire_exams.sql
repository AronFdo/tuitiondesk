-- TuitionDesk — the app no longer runs Cambridge exam entries. Nothing is
-- deleted: exam entries, exam payments, candidate details and the British
-- Council calendar stay in their tables, unused, in case they are wanted back.
-- What changes is the course: its level was one of the Cambridge exams and
-- required; now it is an optional label in the class's own words.
-- Run this in the Supabase SQL editor after 019_attendance.sql. Safe to re-run.

alter table public.courses drop constraint if exists courses_level_check;
alter table public.courses alter column level drop not null;

-- Show the old exam codes as the names people know.
update public.courses
set level = case level
  when 'pre_a1_starters' then 'Pre A1 Starters'
  when 'a1_movers' then 'A1 Movers'
  when 'a2_flyers' then 'A2 Flyers'
  when 'a2_key' then 'A2 Key'
  when 'a2_key_schools' then 'A2 Key for Schools'
  when 'b1_preliminary' then 'B1 Preliminary'
  when 'b1_preliminary_schools' then 'B1 Preliminary for Schools'
  when 'b2_first' then 'B2 First'
  when 'b2_first_schools' then 'B2 First for Schools'
  when 'c1_advanced' then 'C1 Advanced'
  when 'c2_proficiency' then 'C2 Proficiency'
  else level
end
where level in (
  'pre_a1_starters', 'a1_movers', 'a2_flyers', 'a2_key', 'a2_key_schools',
  'b1_preliminary', 'b1_preliminary_schools', 'b2_first', 'b2_first_schools',
  'c1_advanced', 'c2_proficiency'
);

alter table public.courses drop constraint if exists courses_level_length;
alter table public.courses
  add constraint courses_level_length check (level is null or char_length(level) <= 60);
