-- TuitionDesk Phase 1 — private logo bucket.
-- Run this in the Supabase SQL editor after 001_institutes.sql.
-- Logo object path: {institute_id}/logo

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'institute-logos',
  'institute-logos',
  false,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists institute_logos_select on storage.objects;
create policy institute_logos_select on storage.objects
for select to authenticated
using (
  bucket_id = 'institute-logos'
  and (storage.foldername(name))[1] = public.current_institute_id()::text
);

drop policy if exists institute_logos_insert on storage.objects;
create policy institute_logos_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'institute-logos'
  and public.current_role() = 'admin'
  and (storage.foldername(name))[1] = public.current_institute_id()::text
);

drop policy if exists institute_logos_update on storage.objects;
create policy institute_logos_update on storage.objects
for update to authenticated
using (
  bucket_id = 'institute-logos'
  and public.current_role() = 'admin'
  and (storage.foldername(name))[1] = public.current_institute_id()::text
)
with check (
  bucket_id = 'institute-logos'
  and public.current_role() = 'admin'
  and (storage.foldername(name))[1] = public.current_institute_id()::text
);

drop policy if exists institute_logos_delete on storage.objects;
create policy institute_logos_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'institute-logos'
  and public.current_role() = 'admin'
  and (storage.foldername(name))[1] = public.current_institute_id()::text
);
