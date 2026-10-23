-- Keep memory-photo access aligned with the visibility of the star they belong to.
-- Private star photos are limited to the star owner, accepted family, and the photo uploader.
drop policy if exists "Memory photos readable when permitted" on storage.objects;

create policy "Public approved memory photos are readable"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'memory-photos'
  and exists (
    select 1
    from public.memories m
    join public.stars s on s.slug = m.star_slug
    where m.photo_path = objects.name
      and m.approved = true
      and m.archived = false
      and s.is_public = true
  )
);

create policy "Owners and accepted family can read private memory photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'memory-photos'
  and (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or exists (
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
  )
);

-- Private star owners and accepted family must be able to load the parent record
-- used to authorize its associated photos.
drop policy if exists "Members can read public stars" on public.stars;
create policy "Guests can read public stars"
on public.stars for select to anon
using (is_public = true);
create policy "Members can read public stars"
on public.stars for select to authenticated
using (
  is_public = true
  and (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
);
create policy "Owners and accepted family can read private stars"
on public.stars for select to authenticated
using (
  (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  and (
    created_by = auth.uid()
    or exists (
      select 1
      from public.memorial_family_members fm
      where fm.owner_user_id = stars.created_by
        and fm.member_user_id = auth.uid()
        and fm.accepted_at is not null
    )
  )
);

-- Family members receive the same read access to memories attached to a private star.
create policy "Family members can read shared memories"
on public.memories for select to authenticated
using (
  (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  and archived = false
  and exists (
    select 1
    from public.stars s
    join public.memorial_family_members fm on fm.owner_user_id = s.created_by
    where s.slug = memories.star_slug
      and fm.member_user_id = auth.uid()
      and fm.accepted_at is not null
  )
);

-- The memorial-photo bucket also permits public downloads only for explicitly
-- public, approved, active memorials; private access stays with owner/family.
drop policy if exists "Memorial photos readable when permitted" on storage.objects;
create policy "Memorial photos readable when permitted"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'memorial-photos'
  and (
    exists (
      select 1
      from public.memorials m
      where m.photo_path = objects.name
        and m.approved = true
        and m.public_requested = true
        and m.archived = false
        and m.rejection_reason is null
    )
    or (
      (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
      and split_part(name, '/', 1) = auth.uid()::text
    )
    or (
      (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
      and exists (
        select 1
        from public.memorials m
        join public.memorial_family_members fm on fm.owner_user_id = m.user_id
        where m.photo_path = objects.name
          and m.archived = false
          and fm.member_user_id = auth.uid()
          and fm.accepted_at is not null
      )
    )
  )
);
