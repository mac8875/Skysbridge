begin;

create extension if not exists pgcrypto;

-- Ensure the profile table exists and create profiles for users who already signed up.
create table if not exists public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check(display_name is null or char_length(display_name) between 1 and 80),
  country text check(country is null or char_length(country) <= 80),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.profiles(id, display_name)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1))
from auth.users u
on conflict(id) do nothing;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.profiles
    where id = auth.uid()
      and is_admin = true
  );
$$;

revoke all on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin() to authenticated;

create table if not exists public.support_groups(
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check(slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check(char_length(name) between 1 and 100),
  description text not null default '' check(char_length(description) <= 1000),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members(
  group_id uuid not null references public.support_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check(status in ('pending','approved','blocked')),
  role text not null default 'member'
    check(role in ('member','moderator')),
  joined_at timestamptz not null default now(),
  primary key(group_id,user_id)
);

create table if not exists public.group_posts(
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.support_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check(char_length(body) between 1 and 5000),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.support_groups(slug,name,description)
values
  ('newly-bereaved','Newly Bereaved','A gentle room for the first days and months after loss.'),
  ('fathers-space','Fathers'' Space','A protected room for fathers to speak openly without judgment.'),
  ('remembering-together','Remembering Together','A place for anniversaries, memories and rituals of remembrance.')
on conflict(slug) do update
set name=excluded.name,
    description=excluded.description,
    is_active=true;

alter table public.profiles enable row level security;
alter table public.support_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_posts enable row level security;

-- Remove the earlier unsafe general profile update policy.
drop policy if exists "own profile updateable" on public.profiles;
drop policy if exists "profiles select own or admin" on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;

create policy "profiles select own or admin"
on public.profiles for select
using(auth.uid() = id or public.current_user_is_admin());

create policy "profiles insert own"
on public.profiles for insert
with check(auth.uid() = id);

-- Only harmless profile fields may be updated from the browser.
revoke update on public.profiles from authenticated;
grant update(display_name,country) on public.profiles to authenticated;

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
on public.profiles for update
using(auth.uid() = id)
with check(auth.uid() = id);

drop policy if exists "groups readable by members" on public.support_groups;
create policy "groups readable by members"
on public.support_groups for select
using(auth.uid() is not null and (is_active = true or public.current_user_is_admin()));

drop policy if exists "membership own insert" on public.group_members;
drop policy if exists "membership own or admin select" on public.group_members;
drop policy if exists "membership admin update" on public.group_members;
drop policy if exists "membership admin delete" on public.group_members;

create policy "membership own insert"
on public.group_members for insert
with check(
  auth.uid() = user_id
  and (
    status = 'pending'
    or public.current_user_is_admin()
  )
);

create policy "membership own or admin select"
on public.group_members for select
using(auth.uid() = user_id or public.current_user_is_admin());

create policy "membership admin update"
on public.group_members for update
using(public.current_user_is_admin())
with check(public.current_user_is_admin());

create policy "membership admin delete"
on public.group_members for delete
using(public.current_user_is_admin());

drop policy if exists "approved room posts readable" on public.group_posts;
drop policy if exists "approved room posts insertable" on public.group_posts;
drop policy if exists "own posts updateable" on public.group_posts;
drop policy if exists "own posts deletable" on public.group_posts;

create policy "approved room posts readable"
on public.group_posts for select
using(
  public.current_user_is_admin()
  or exists(
    select 1
    from public.group_members gm
    where gm.group_id = group_posts.group_id
      and gm.user_id = auth.uid()
      and gm.status = 'approved'
  )
);

create policy "approved room posts insertable"
on public.group_posts for insert
with check(
  auth.uid() = user_id
  and (
    public.current_user_is_admin()
    or exists(
      select 1
      from public.group_members gm
      where gm.group_id = group_posts.group_id
        and gm.user_id = auth.uid()
        and gm.status = 'approved'
    )
  )
);

create policy "own posts updateable"
on public.group_posts for update
using(auth.uid() = user_id or public.current_user_is_admin())
with check(auth.uid() = user_id or public.current_user_is_admin());

create policy "own posts deletable"
on public.group_posts for delete
using(auth.uid() = user_id or public.current_user_is_admin());

-- Allow administrators to review existing memorial and memory tables.
drop policy if exists "admin memorial review" on public.memorials;
create policy "admin memorial review"
on public.memorials for update
using(public.current_user_is_admin())
with check(public.current_user_is_admin());

drop policy if exists "admin memorial read" on public.memorials;
create policy "admin memorial read"
on public.memorials for select
using(auth.uid() = user_id or public.current_user_is_admin());

drop policy if exists "admin memory review" on public.memories;
create policy "admin memory review"
on public.memories for update
using(public.current_user_is_admin())
with check(public.current_user_is_admin());

drop policy if exists "admin memory read" on public.memories;
create policy "admin memory read"
on public.memories for select
using(status = 'approved' or auth.uid() = user_id or public.current_user_is_admin());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.profiles(id,display_name)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1))
  )
  on conflict(id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

commit;