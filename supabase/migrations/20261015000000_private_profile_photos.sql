-- Move profile photos to a private bucket. The previous migration created a
-- public bucket, which is incompatible with the private per-user path requirement.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view profile photos" on storage.objects;
drop policy if exists "Users read own profile photos" on storage.objects;
create policy "Users read own profile photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

comment on column public.profiles.avatar_url is 'Private profile-photos object path (<user uuid>/avatar.ext); render through a short-lived signed URL.';
