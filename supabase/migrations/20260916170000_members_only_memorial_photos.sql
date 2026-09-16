-- Restrict memorial photo reads to signed-in members. Public star text remains public.
drop policy if exists "Memorial photos readable when permitted" on storage.objects;
create policy "Memorial photos readable when permitted"
on storage.objects for select to authenticated
using (bucket_id = 'memorial-photos'
  and (auth.jwt()->>'is_anonymous') is distinct from 'true'
  and (split_part(name, '/', 1) = (select auth.uid())::text
    or public.is_admin()
    or exists (
      select 1 from public.memorials m
      where m.photo_path = objects.name
        and m.approved = true and m.public_requested = true and m.archived = false
    )));
