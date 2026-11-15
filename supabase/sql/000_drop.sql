-- TuitionDesk — wipe the class tables and start again.
-- Run this first in the Supabase SQL editor, then every numbered file in order.
-- auth.users is left in place. The buckets stay; their files do not.
-- Tables go first. The row policies depend on the helpers, so those functions
-- can be dropped only after the tables are gone.

drop table if exists public.receipts cascade;
drop table if exists public.attendance cascade;
drop table if exists public.class_sessions cascade;
drop table if exists public.institute_counters cascade;
drop table if exists public.notices cascade;
drop table if exists public.course_files cascade;
drop table if exists public.guardian_links cascade;
drop table if exists public.student_documents cascade;
drop table if exists public.exam_payments cascade;
drop table if exists public.exam_registrations cascade;
drop table if exists public.tuition_payments cascade;
drop table if exists public.exams cascade;
drop table if exists public.enrollments cascade;
drop table if exists public.courses cascade;
drop table if exists public.students cascade;
drop table if exists public.levels cascade;
drop table if exists public.activity_log cascade;
drop table if exists public.memberships cascade;
drop table if exists public.profiles cascade;
drop table if exists public.institutes cascade;
drop table if exists public.exam_catalogue_sessions cascade;
drop table if exists public.exam_catalogue_fees cascade;

drop function if exists public.add_student_to_course(uuid, text, text, text, date);
drop function if exists public.add_student_to_course(uuid, text, date, text, text, text, date);
drop function if exists public.drop_entries_of_archived_student();
drop function if exists public.withdraw_entries_of_archived_student();
drop function if exists public.touch_last_seen();
drop function if exists public.student_in_current_institute(uuid);
drop function if exists public.teacher_has_student(uuid);
drop function if exists public.teacher_teaches_course(uuid);
drop function if exists public.seed_institute_levels();
drop function if exists public.course_in_current_institute(uuid);
drop function if exists public.student_on_course(uuid, uuid);
drop function if exists public.exam_on_course(uuid, uuid);
drop function if exists public.exam_course_id(uuid);
drop function if exists public.registration_for_student(uuid, uuid);
drop function if exists public.registration_on_course(uuid, uuid, uuid);
drop function if exists public.overdue_tuition_minor(date);
drop function if exists public.parent_can_read_course(uuid);
drop function if exists public.parent_has_student(uuid);
drop function if exists public.record_tuition_payment(uuid, uuid, integer, date, date);
drop function if exists public.mark_receipt_printed(uuid);
drop function if exists public.void_receipt_of_payment();
drop function if exists public.record_scan(uuid, text, text, timestamptz);
drop function if exists public.set_attendance(uuid, uuid, boolean);
drop function if exists public.open_class_session(uuid, date);
drop function if exists public.close_class_session(uuid);
drop function if exists public.can_run_course(uuid);
drop function if exists public.import_students(jsonb, date);
drop function if exists public.create_student(jsonb, uuid[], date);
drop function if exists public.insert_student_row(public.students);
drop function if exists public.student_from_json(uuid, jsonb);
drop function if exists public.compose_student_full_name();
drop function if exists public.assign_student_identity();
drop function if exists public.keep_student_code();
drop function if exists public.next_institute_counter(uuid, text);
drop function if exists public.new_qr_token();
drop function if exists public.format_student_code(bigint);

delete from storage.objects
where bucket_id in ('institute-logos', 'course-files', 'student-documents', 'student-photos');
