-- Optional memorial photographs remain in a private bucket until family consent and approval.
alter table public.memorials add column if not exists photo_path text;
alter table public.memorials drop constraint if exists memorial_photo_owned_path;
alter table public.memorials add constraint memorial_photo_owned_path
  check (photo_path is null or
    (split_part(photo_path, '/', 1) = user_id::text
     and photo_path ~ ('^' || user_id::text || '/[0-9a-f-]{36}[.](jpg|png|webp)$')));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memorial-photos', 'memorial-photos', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Members can upload own memorial photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'memorial-photos'
  and split_part(name, '/', 1) = (select auth.uid())::text);

create policy "Memorial photos readable when permitted"
on storage.objects for select to anon, authenticated
using (bucket_id = 'memorial-photos'
  and (split_part(name, '/', 1) = (select auth.uid())::text
    or public.is_admin()
    or exists (
      select 1 from public.memorials m
      where m.photo_path = objects.name
        and m.approved = true and m.public_requested = true and m.archived = false
    )));

create policy "Owners and admins can remove memorial photos"
on storage.objects for delete to authenticated
using (bucket_id = 'memorial-photos'
  and (public.is_admin() or
    (split_part(name, '/', 1) = (select auth.uid())::text
     and not exists (select 1 from public.memorials m where m.photo_path = objects.name))));
