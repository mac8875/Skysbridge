-- Remove uploader-only access to photos attached to private stars.
-- The private-star audience is exactly the star owner and accepted family.
drop policy if exists "Owners and accepted family can read private memory photos" on storage.objects;
create policy "Owners and accepted family can read private memory photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'memory-photos'
  and (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  and exists (
    select 1
    from public.memories m
    join public.stars s on s.slug = m.star_slug
    where m.photo_path = objects.name
      and m.archived = false
      and (
        s.created_by = auth.uid()
        or exists (
          select 1
          from public.memorial_family_members fm
          where fm.owner_user_id = s.created_by
            and fm.member_user_id = auth.uid()
            and fm.accepted_at is not null
        )
      )
  )
);
