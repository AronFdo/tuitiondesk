-- TuitionDesk — numbered receipts for tuition payments, printed on a thermal
-- printer at the desk. Recording a payment and issuing its receipt happen in
-- one transaction, so a failed payment never uses up a receipt number. Voiding
-- a payment voids its receipt, and reprints are counted so a copy says COPY.
-- Run this in the Supabase SQL editor after 020_retire_exams.sql. Safe to re-run.

-- How receipts print, per class.
alter table public.institutes
  add column if not exists receipt_paper_mm smallint not null default 80,
  add column if not exists receipt_footer text;

alter table public.institutes drop constraint if exists institutes_receipt_paper_mm_check;
alter table public.institutes
  add constraint institutes_receipt_paper_mm_check check (receipt_paper_mm in (58, 80));
alter table public.institutes drop constraint if exists institutes_receipt_footer_length;
alter table public.institutes
  add constraint institutes_receipt_footer_length
  check (receipt_footer is null or char_length(receipt_footer) <= 200);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete restrict,
  receipt_no bigint not null,
  student_id uuid not null references public.students (id) on delete restrict,
  tuition_payment_id uuid not null unique references public.tuition_payments (id) on delete restrict,
  total_minor integer not null check (total_minor > 0),
  issued_at timestamptz not null default now(),
  issued_by uuid references public.profiles (id) on delete set null,
  print_count integer not null default 0,
  last_printed_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institute_id, receipt_no)
);

create index if not exists receipts_student on public.receipts (student_id, issued_at desc);

alter table public.receipts enable row level security;
revoke all on public.receipts from anon, authenticated;
grant select on public.receipts to authenticated;
grant all on public.receipts to service_role;

-- Receipts are money records: the class owner only, like payments.
drop policy if exists receipts_select_admin on public.receipts;
create policy receipts_select_admin on public.receipts
for select to authenticated
using (
  institute_id = public.current_institute_id()
  and public.current_role() = 'admin'
);

-- Record a tuition payment and issue its receipt. Returns the receipt.
create or replace function public.record_tuition_payment(
  p_course_id uuid,
  p_student_id uuid,
  p_amount_minor integer,
  p_paid_on date,
  p_period_month date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  institute uuid := public.current_institute_id();
  new_payment_id uuid;
  new_receipt_id uuid;
  new_receipt_no bigint;
begin
  if public.current_role() is distinct from 'admin' then
    raise exception 'not allowed';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'bad amount';
  end if;
  if p_paid_on is null or p_period_month is null or extract(day from p_period_month) <> 1 then
    raise exception 'bad date';
  end if;
  if not public.course_in_current_institute(p_course_id)
    or not public.student_on_course(p_student_id, p_course_id) then
    raise exception 'not enrolled';
  end if;

  insert into public.tuition_payments (
    institute_id, course_id, student_id, amount_minor, paid_on, period_month
  )
  values (institute, p_course_id, p_student_id, p_amount_minor, p_paid_on, p_period_month)
  returning id into new_payment_id;

  new_receipt_no := public.next_institute_counter(institute, 'receipt');
  insert into public.receipts (
    institute_id, receipt_no, student_id, tuition_payment_id, total_minor, issued_by
  )
  values (institute, new_receipt_no, p_student_id, new_payment_id, p_amount_minor, auth.uid())
  returning id into new_receipt_id;

  insert into public.activity_log (institute_id, actor_profile_id, action, entity, entity_id, data)
  values (
    institute, auth.uid(), 'tuition_payment_recorded', 'tuition_payments', new_payment_id,
    jsonb_build_object('receipt_no', new_receipt_no, 'amount_minor', p_amount_minor)
  );

  return jsonb_build_object(
    'payment_id', new_payment_id,
    'receipt_id', new_receipt_id,
    'receipt_no', new_receipt_no
  );
end;
$$;

-- A receipt was sent to the printer. The first print is the original; every
-- later one prints as a copy.
create or replace function public.mark_receipt_printed(p_receipt_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  printed integer;
begin
  if public.current_role() is distinct from 'admin' then
    raise exception 'not allowed';
  end if;
  update public.receipts
  set print_count = print_count + 1,
      last_printed_at = now(),
      updated_at = now()
  where id = p_receipt_id
    and institute_id = public.current_institute_id()
  returning print_count into printed;
  if printed is null then
    raise exception 'receipt not found';
  end if;
  return printed;
end;
$$;

-- Voiding a payment voids its receipt, whichever path voids it.
create or replace function public.void_receipt_of_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.voided_at is not null and old.voided_at is null then
    update public.receipts
    set voided_at = new.voided_at, updated_at = now()
    where tuition_payment_id = new.id and voided_at is null;
  end if;
  return new;
end;
$$;

revoke all on function public.void_receipt_of_payment() from public, anon, authenticated;

drop trigger if exists tuition_payments_void_receipt on public.tuition_payments;
create trigger tuition_payments_void_receipt
after update of voided_at on public.tuition_payments
for each row execute function public.void_receipt_of_payment();

revoke all on function public.record_tuition_payment(uuid, uuid, integer, date, date) from public, anon;
revoke all on function public.mark_receipt_printed(uuid) from public, anon;
grant execute on function public.record_tuition_payment(uuid, uuid, integer, date, date) to authenticated;
grant execute on function public.mark_receipt_printed(uuid) to authenticated;

-- Payments recorded before receipts existed get receipts too, numbered in the
-- order they were paid. They count as already printed, so a reprint says COPY.
do $$
declare
  payment record;
begin
  for payment in
    select p.id, p.institute_id, p.student_id, p.amount_minor, p.created_at, p.voided_at
    from public.tuition_payments p
    where not exists (select 1 from public.receipts r where r.tuition_payment_id = p.id)
    order by p.institute_id, p.paid_on, p.created_at, p.id
  loop
    insert into public.receipts (
      institute_id, receipt_no, student_id, tuition_payment_id, total_minor,
      issued_at, print_count, voided_at
    )
    values (
      payment.institute_id,
      public.next_institute_counter(payment.institute_id, 'receipt'),
      payment.student_id,
      payment.id,
      payment.amount_minor,
      payment.created_at,
      1,
      payment.voided_at
    );
  end loop;
end;
$$;
