-- Allow a member to invite family accounts to read their memorials and private photos.
create table if not exists public.memorial_family_invites (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  owner_name text not null default 'Skysbridge member'
    check (char_length(owner_name) between 1 and 80),
  invited_email text not null
    check (
      char_length(invited_email) between 5 and 254
      and invited_email = lower(btrim(invited_email))
      and invited_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    ),
  created_at timestamptz not null default now(),
  constraint memorial_family_invites_owner_email_key unique (owner_user_id, invited_email)
);

create table if not exists public.memorial_family_members (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null unique
    references public.memorial_family_invites(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  accepted_at timestamptz not null default now(),
  constraint memorial_family_members_not_self check (owner_user_id <> member_user_id),
  constraint memorial_family_members_owner_member_key unique (owner_user_id, member_user_id)
);

create index if not exists memorial_family_invites_owner_created_idx
  on public.memorial_family_invites (owner_user_id, created_at desc);
create index if not exists memorial_family_invites_email_idx
  on public.memorial_family_invites (invited_email);
create index if not exists memorial_family_members_member_idx
  on public.memorial_family_members (member_user_id);

alter table public.memorial_family_invites enable row level security;
alter table public.memorial_family_members enable row level security;

revoke all on public.memorial_family_invites from anon, authenticated, public;
revoke all on public.memorial_family_members from anon, authenticated, public;
grant select, insert, delete on public.memorial_family_invites to authenticated;
grant select, insert on public.memorial_family_members to authenticated;

drop policy if exists "Family invites visible to owner or invited account" on public.memorial_family_invites;
create policy "Family invites visible to owner or invited account"
on public.memorial_family_invites
for select to authenticated
using (
  owner_user_id = (select auth.uid())
  or invited_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
);

drop policy if exists "Members can invite family accounts" on public.memorial_family_invites;
create policy "Members can invite family accounts"
on public.memorial_family_invites
for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and invited_email <> lower(coalesce((select auth.jwt() ->> 'email'), ''))
  and (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
);

drop policy if exists "Members can revoke their family invites" on public.memorial_family_invites;
create policy "Members can revoke their family invites"
on public.memorial_family_invites
for delete to authenticated
using (owner_user_id = (select auth.uid()));

drop policy if exists "Family accounts can read their accepted memberships" on public.memorial_family_members;
create policy "Family accounts can read their accepted memberships"
on public.memorial_family_members
for select to authenticated
using (
  member_user_id = (select auth.uid())
  or owner_user_id = (select auth.uid())
);

drop policy if exists "Invited accounts can accept family access" on public.memorial_family_members;
create policy "Invited accounts can accept family access"
on public.memorial_family_members
for insert to authenticated
with check (
  member_user_id = (select auth.uid())
  and (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  and exists (
    select 1
    from public.memorial_family_invites i
    where i.id = memorial_family_members.invite_id
      and i.owner_user_id = memorial_family_members.owner_user_id
      and i.invited_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);

drop policy if exists "Family members can read shared memorial details" on public.memorials;
create policy "Family members can read shared memorial details"
on public.memorials
for select to authenticated
using (
  (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  and exists (
    select 1
    from public.memorial_family_members fm
    where fm.owner_user_id = memorials.user_id
      and fm.member_user_id = (select auth.uid())
  )
);

drop policy if exists "Family members can read shared memorial photos" on storage.objects;
create policy "Family members can read shared memorial photos"
on storage.objects
for select to authenticated
using (
  bucket_id = 'memorial-photos'
  and (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  and exists (
    select 1
    from public.memorials m
    join public.memorial_family_members fm
      on fm.owner_user_id = m.user_id
    where m.photo_path = objects.name
      and fm.member_user_id = (select auth.uid())
      and m.archived = false
  )
);
