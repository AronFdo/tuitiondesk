-- TuitionDesk — the British Council takes a Postal ID from candidates under 16,
-- in place of an NIC or passport. From 16 a candidate needs an NIC or passport.
-- Run this in the Supabase SQL editor after 015_student_basics.sql. Safe to re-run.

alter table public.students drop constraint if exists students_id_type_check;
alter table public.students
  add constraint students_id_type_check check (id_type in ('nic', 'passport', 'postal_id'));

alter table public.student_documents drop constraint if exists student_documents_kind_check;
alter table public.student_documents
  add constraint student_documents_kind_check check (
    kind in (
      'id_copy', 'passport', 'postal_id', 'birth_certificate', 'photo',
      'payment_proof', 'statement_of_entry', 'result_slip', 'certificate', 'other'
    )
  );
