-- Let star owners read memories and attached photos on their own stars, including pending entries.
create policy "Owners can read memories for their stars"
on public.memories for select to authenticated
using (
  (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  and exists (
    select 1
    from public.stars s
    where s.slug = memories.star_slug
      and s.created_by = auth.uid()
  )
);
