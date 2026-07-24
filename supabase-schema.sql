-- Sky's Bridge — complete Supabase platform foundation
-- Safe to run as a Supabase migration.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(coalesce(new.raw_user_meta_data ->> 'display_name', ''), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Backfill profiles for accounts that already exist.
insert into public.profiles (id, display_name)
select u.id, nullif(coalesce(u.raw_user_meta_data ->> 'display_name', ''), '')
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Public stars / approved memorial pages
-- ---------------------------------------------------------------------------
create table if not exists public.stars (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  child_name text not null check (char_length(child_name) between 1 and 80),
  subtitle text check (subtitle is null or char_length(subtitle) <= 160),
  story text check (story is null or char_length(story) <= 5000),
  loved_by text check (loved_by is null or char_length(loved_by) <= 160),
  birth_date date,
  passing_date date,
  photo_url text,
  is_featured boolean not null default false,
  is_public boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sky is the permanent first star. The static page can continue to show him,
-- while this record prepares future dynamic loading.
insert into public.stars (
  slug, child_name, subtitle, story, loved_by, is_featured, is_public
)
values (
  'sky',
  'Sky',
  'Forever our son. Forever our light.',
  'Sky lived only a short time, but he changed our lives forever. His life taught us that love is not measured in years, but in the depth of the bond we share. After losing him, we discovered how lonely grief can become. Many parents carry their pain in silence, believing they are alone. Sky''s Bridge was created in his memory—to build bridges between families who understand this journey, to ensure that every child is remembered, and that no parent has to grieve alone. Sky is the first star on our Wall of Stars. His light became the beginning of thousands of others.',
  'Mum & Dad',
  true,
  true
)
on conflict (slug) do update set
  child_name = excluded.child_name,
  subtitle = excluded.subtitle,
  story = excluded.story,
  loved_by = excluded.loved_by,
  is_featured = true,
  is_public = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Private memorial submissions awaiting review
-- ---------------------------------------------------------------------------
create table if not exists public.memorials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  child_name text not null check (char_length(child_name) between 1 and 80),
  remembrance text not null default '' check (char_length(remembrance) <= 5000),
  public_requested boolean not null default false,
  approved boolean not null default false,
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Memories left for a star
-- ---------------------------------------------------------------------------
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  star_slug text not null default 'sky' references public.stars(slug) on update cascade on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 80),
  message text not null check (char_length(message) between 1 and 800),
  approved boolean not null default false,
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Protected support groups
-- ---------------------------------------------------------------------------
create table if not exists public.support_groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.support_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'moderator')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'blocked')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.support_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Initial protected rooms; content remains inaccessible until membership approval.
insert into public.support_groups (slug, name, description)
values
  ('newly-bereaved', 'Newly Bereaved', 'A protected room for parents and families in the first stage of grief.'),
  ('fathers-space', 'Fathers’ Space', 'A protected room for fathers to speak openly and support one another.'),
  ('remembering-together', 'Remembering Together', 'A protected room for sharing anniversaries, memories and rituals of remembrance.')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Updated-at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'profiles_set_updated_at') then
    create trigger profiles_set_updated_at before update on public.profiles
    for each row execute procedure public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'stars_set_updated_at') then
    create trigger stars_set_updated_at before update on public.stars
    for each row execute procedure public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'memorials_set_updated_at') then
    create trigger memorials_set_updated_at before update on public.memorials
    for each row execute procedure public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'memories_set_updated_at') then
    create trigger memories_set_updated_at before update on public.memories
    for each row execute procedure public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'group_posts_set_updated_at') then
    create trigger group_posts_set_updated_at before update on public.group_posts
    for each row execute procedure public.set_updated_at();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.stars enable row level security;
alter table public.memorials enable row level security;
alter table public.memories enable row level security;
alter table public.support_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_posts enable row level security;

-- Profiles
drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and is_admin = false);

-- Stars
drop policy if exists "Anyone can read public stars" on public.stars;
create policy "Anyone can read public stars"
on public.stars for select to anon, authenticated
using (is_public = true);

drop policy if exists "Admins manage stars" on public.stars;
create policy "Admins manage stars"
on public.stars for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Memorial submissions
drop policy if exists "Members can create their own memorials" on public.memorials;
create policy "Members can create their own memorials"
on public.memorials for insert to authenticated
with check (auth.uid() = user_id and approved = false);

drop policy if exists "Members can read their own memorials" on public.memorials;
create policy "Members can read their own memorials"
on public.memorials for select to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Anyone can read approved memorials" on public.memorials;
create policy "Anyone can read approved memorials"
on public.memorials for select to anon, authenticated
using (approved = true and public_requested = true);

drop policy if exists "Members can update their own unapproved memorials" on public.memorials;
create policy "Members can update their own unapproved memorials"
on public.memorials for update to authenticated
using ((auth.uid() = user_id and approved = false) or public.is_admin())
with check ((auth.uid() = user_id and approved = false) or public.is_admin());

drop policy if exists "Members can delete their own unapproved memorials" on public.memorials;
create policy "Members can delete their own unapproved memorials"
on public.memorials for delete to authenticated
using ((auth.uid() = user_id and approved = false) or public.is_admin());

-- Memories
drop policy if exists "Members can submit memories" on public.memories;
create policy "Members can submit memories"
on public.memories for insert to authenticated
with check (auth.uid() = user_id and approved = false);

drop policy if exists "Members can read their own memories" on public.memories;
create policy "Members can read their own memories"
on public.memories for select to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Anyone can read approved memories" on public.memories;
create policy "Anyone can read approved memories"
on public.memories for select to anon, authenticated
using (approved = true);

drop policy if exists "Members can update their own unapproved memories" on public.memories;
create policy "Members can update their own unapproved memories"
on public.memories for update to authenticated
using ((auth.uid() = user_id and approved = false) or public.is_admin())
with check ((auth.uid() = user_id and approved = false) or public.is_admin());

drop policy if exists "Members can delete their own unapproved memories" on public.memories;
create policy "Members can delete their own unapproved memories"
on public.memories for delete to authenticated
using ((auth.uid() = user_id and approved = false) or public.is_admin());

-- Groups
drop policy if exists "Authenticated users can list active groups" on public.support_groups;
create policy "Authenticated users can list active groups"
on public.support_groups for select to authenticated
using (is_active = true or public.is_admin());

drop policy if exists "Admins manage groups" on public.support_groups;
create policy "Admins manage groups"
on public.support_groups for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users can request group membership" on public.group_members;
create policy "Users can request group membership"
on public.group_members for insert to authenticated
with check (user_id = auth.uid() and role = 'member' and status = 'pending');

drop policy if exists "Users can read own membership" on public.group_members;
create policy "Users can read own membership"
on public.group_members for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Admins manage memberships" on public.group_members;
create policy "Admins manage memberships"
on public.group_members for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users can leave groups" on public.group_members;
create policy "Users can leave groups"
on public.group_members for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Approved members can read group posts" on public.group_posts;
create policy "Approved members can read group posts"
on public.group_posts for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.group_members gm
    where gm.group_id = group_posts.group_id
      and gm.user_id = auth.uid()
      and gm.status = 'approved'
  )
);

drop policy if exists "Approved members can create group posts" on public.group_posts;
create policy "Approved members can create group posts"
on public.group_posts for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.group_members gm
    where gm.group_id = group_posts.group_id
      and gm.user_id = auth.uid()
      and gm.status = 'approved'
  )
);

drop policy if exists "Authors can update own visible posts" on public.group_posts;
create policy "Authors can update own visible posts"
on public.group_posts for update to authenticated
using ((user_id = auth.uid() and is_hidden = false) or public.is_admin())
with check ((user_id = auth.uid()) or public.is_admin());

drop policy if exists "Authors can delete own posts" on public.group_posts;
create policy "Authors can delete own posts"
on public.group_posts for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists stars_public_idx
on public.stars (is_public, is_featured desc, created_at asc);

create index if not exists memorials_public_idx
on public.memorials (approved, public_requested, created_at desc);

create index if not exists memorials_user_idx
on public.memorials (user_id, created_at desc);

create index if not exists memories_star_idx
on public.memories (star_slug, approved, created_at desc);

create index if not exists memories_user_idx
on public.memories (user_id, created_at desc);

create index if not exists group_members_user_idx
on public.group_members (user_id, status);

create index if not exists group_posts_group_idx
on public.group_posts (group_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Grants (RLS still controls access)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.stars to anon, authenticated;
grant select on public.memorials to anon, authenticated;
grant select on public.memories to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.memorials to authenticated;
grant select, insert, update, delete on public.memories to authenticated;
grant select, insert, update, delete on public.support_groups to authenticated;
grant select, insert, update, delete on public.group_members to authenticated;
grant select, insert, update, delete on public.group_posts to authenticated;
grant select, insert, update, delete on public.stars to authenticated;
