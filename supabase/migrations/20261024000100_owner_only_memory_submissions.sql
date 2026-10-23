-- Only the owner of a star may submit a memory to it.
-- Family members retain read access, but their family role does not grant write access.
drop policy if exists "Members can submit memories" on public.memories;
create policy "Members can submit memories"
on public.memories for insert to authenticated
with check (
  auth.uid() = user_id
  and (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  and approved = false
  and (
    (
      memorial_id is null
      and star_slug is not null
      and exists (
        select 1
        from public.stars s
        where s.slug = memories.star_slug
          and s.created_by = auth.uid()
      )
    )
    or (
      memorial_id is not null
      and star_slug is null
      and exists (
        select 1
        from public.memorials m
        where m.id = memories.memorial_id
          and m.user_id = auth.uid()
          and m.archived = false
          and m.rejection_reason is null
      )
    )
  )
);

notify pgrst, 'reload schema';
