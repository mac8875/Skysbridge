-- Guests may see the star shapes, but memorial details and stories are member-only.
alter table public.memorials enable row level security;

drop policy if exists "Anyone can read approved memorials" on public.memorials;
drop policy if exists "Guests can see published star shapes" on public.memorials;
drop policy if exists "Members can read approved memorial details" on public.memorials;
drop policy if exists "Members can read their own memorials" on public.memorials;

create policy "Guests can see published star shapes"
on public.memorials for select to anon
using (approved = true and public_requested = true and archived = false);

create policy "Members can read approved memorial details"
on public.memorials for select to authenticated
using (
  (auth.jwt()->>'is_anonymous') is distinct from 'true'
  and approved = true
  and public_requested = true
  and archived = false
);

create policy "Members can read their own memorials"
on public.memorials for select to authenticated
using (
  (auth.jwt()->>'is_anonymous') is distinct from 'true'
  and (auth.uid() = user_id or public.is_admin())
);

-- Column grants make the guest endpoint incapable of returning names, dates,
-- locations, stories, photo paths, owner IDs, or moderation fields.
revoke all on table public.memorials from anon;
grant select (star_style) on table public.memorials to anon;

-- The Sky story is also served from this table, so it must follow the same rule.
drop policy if exists "Anyone can read public stars" on public.stars;
drop policy if exists "public stars readable" on public.stars;
drop policy if exists "Members can read public stars" on public.stars;
create policy "Members can read public stars"
on public.stars for select to authenticated
using (
  is_public = true
  and (auth.jwt()->>'is_anonymous') is distinct from 'true'
);
revoke all on table public.stars from anon;
