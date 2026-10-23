-- Attach memories and their photos directly to any Wall of Stars memorial.
alter table public.memories
  add column if not exists memorial_id uuid references public.memorials(id) on delete cascade;
alter table public.memories alter column star_slug drop default;
alter table public.memories alter column star_slug drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'memories_exactly_one_parent'
      and conrelid = 'public.memories'::regclass
  ) then
    alter table public.memories
      add constraint memories_exactly_one_parent
      check (num_nonnulls(star_slug, memorial_id) = 1);
  end if;
end $$;

create index if not exists memories_memorial_idx
  on public.memories (memorial_id, approved, created_at desc);

-- Only approved memories attached to public stars are public.
-- Owners and accepted family retain read access to all memories on their stars.
drop policy if exists "Anyone can read approved memories" on public.memories;
create policy "Anyone can read approved memories"
on public.memories for select to anon, authenticated
using (
  approved = true
  and archived = false
  and (
    (
      memorial_id is null
      and exists (
        select 1 from public.stars s
        where s.slug = memories.star_slug and s.is_public = true
      )
    )
    or exists (
      select 1 from public.memorials m
      where m.id = memories.memorial_id
        and m.public_requested = true
        and m.approved = true
        and m.archived = false
        and m.rejection_reason is null
    )
  )
);

drop policy if exists "Family members can read shared memories" on public.memories;
create policy "Family members can read shared memories"
on public.memories for select to authenticated
using (
  (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  and archived = false
  and (
    exists (
      select 1 from public.stars s
      join public.memorial_family_members fm on fm.owner_user_id = s.created_by
      where s.slug = memories.star_slug
        and fm.member_user_id = auth.uid()
        and fm.accepted_at is not null
    )
    or exists (
      select 1 from public.memorials m
      join public.memorial_family_members fm on fm.owner_user_id = m.user_id
      where m.id = memories.memorial_id
        and fm.member_user_id = auth.uid()
        and fm.accepted_at is not null
    )
  )
);

drop policy if exists "Owners can read memories for their stars" on public.memories;
create policy "Owners can read memories for their stars"
on public.memories for select to authenticated
using (
  (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  and archived = false
  and (
    exists (
      select 1 from public.stars s
      where s.slug = memories.star_slug and s.created_by = auth.uid()
    )
    or exists (
      select 1 from public.memorials m
      where m.id = memories.memorial_id and m.user_id = auth.uid()
    )
  )
);

-- Public visitors may submit memories only to an approved public memorial.
-- A private memorial accepts entries only from its owner or accepted family.
drop policy if exists "Members can submit memories" on public.memories;
create policy "Members can submit memories"
on public.memories for insert to authenticated
with check (
  auth.uid() = user_id
  and approved = false
  and (
    (memorial_id is null and star_slug is not null)
    or (
      memorial_id is not null
      and star_slug is null
      and exists (
        select 1 from public.memorials m
        where m.id = memories.memorial_id
          and m.archived = false
          and m.rejection_reason is null
          and (
            (m.public_requested = true and m.approved = true)
            or m.user_id = auth.uid()
            or exists (
              select 1 from public.memorial_family_members fm
              where fm.owner_user_id = m.user_id
                and fm.member_user_id = auth.uid()
                and fm.accepted_at is not null
            )
          )
      )
    )
  )
);

-- Align memory-photo storage permissions with either kind of parent star.
drop policy if exists "Public approved memory photos are readable" on storage.objects;
create policy "Public approved memory photos are readable"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'memory-photos'
  and exists (
    select 1 from public.memories m
    where m.photo_path = objects.name
      and m.approved = true
      and m.archived = false
      and (
        exists (
          select 1 from public.stars s
          where s.slug = m.star_slug and s.is_public = true
        )
        or exists (
          select 1 from public.memorials memorial
          where memorial.id = m.memorial_id
            and memorial.public_requested = true
            and memorial.approved = true
            and memorial.archived = false
            and memorial.rejection_reason is null
        )
      )
  )
);

drop policy if exists "Owners and accepted family can read private memory photos" on storage.objects;
create policy "Owners and accepted family can read private memory photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'memory-photos'
  and (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  and exists (
    select 1 from public.memories m
    where m.photo_path = objects.name
      and m.archived = false
      and (
        exists (
          select 1 from public.stars s
          where s.slug = m.star_slug
            and (
              s.created_by = auth.uid()
              or exists (
                select 1 from public.memorial_family_members fm
                where fm.owner_user_id = s.created_by
                  and fm.member_user_id = auth.uid()
                  and fm.accepted_at is not null
              )
            )
        )
        or exists (
          select 1 from public.memorials memorial
          where memorial.id = m.memorial_id
            and (
              memorial.user_id = auth.uid()
              or exists (
                select 1 from public.memorial_family_members fm
                where fm.owner_user_id = memorial.user_id
                  and fm.member_user_id = auth.uid()
                  and fm.accepted_at is not null
              )
            )
        )
        or (
          is_admin()
          and (
            exists (
              select 1 from public.stars s
              where s.slug = m.star_slug and s.is_public = true
            )
            or exists (
              select 1 from public.memorials memorial
              where memorial.id = m.memorial_id
                and memorial.public_requested = true
                and memorial.archived = false
            )
          )
        )
      )
  )
);
