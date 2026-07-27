begin;
create extension if not exists pgcrypto;

create table if not exists public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check(display_name is null or char_length(display_name) between 1 and 80),
  country text check(country is null or char_length(country) <= 80),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.stars(
  slug text primary key check(slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check(char_length(name) between 1 and 80),
  story text not null default '' check(char_length(story) <= 8000),
  is_public boolean not null default false,
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.memorials(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  child_name text not null check(char_length(child_name) between 1 and 80),
  remembrance text not null check(char_length(remembrance) <= 5000),
  country text check(country is null or char_length(country) <= 80),
  public_requested boolean not null default false,
  status text not null default 'pending' check(status in ('pending','approved','declined')),
  created_at timestamptz not null default now()
);

create table if not exists public.memories(
  id uuid primary key default gen_random_uuid(),
  star_slug text not null references public.stars(slug) on update cascade on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check(char_length(author_name) between 1 and 80),
  message text not null check(char_length(message) between 1 and 800),
  status text not null default 'pending' check(status in ('pending','approved','declined')),
  created_at timestamptz not null default now()
);

insert into public.stars(slug,name,story,is_public,is_featured)
values(
  'sky',
  'Sky',
  'Sky lived only a short time, but his life changed everything. His light became the beginning of Skysbridge—a place where children are named, remembered and forever part of their families'' stories.',
  true,
  true
)
on conflict(slug) do update
set name=excluded.name, story=excluded.story, is_public=true, is_featured=true;

alter table public.profiles enable row level security;
alter table public.stars enable row level security;
alter table public.memorials enable row level security;
alter table public.memories enable row level security;

drop policy if exists "public stars readable" on public.stars;
create policy "public stars readable"
on public.stars for select using(is_public=true);

drop policy if exists "own profile readable" on public.profiles;
create policy "own profile readable"
on public.profiles for select using(auth.uid()=id);

drop policy if exists "own profile insertable" on public.profiles;
create policy "own profile insertable"
on public.profiles for insert with check(auth.uid()=id);

drop policy if exists "own profile updateable" on public.profiles;
create policy "own profile updateable"
on public.profiles for update using(auth.uid()=id);

drop policy if exists "own memorial insert" on public.memorials;
create policy "own memorial insert"
on public.memorials for insert with check(auth.uid()=user_id);

drop policy if exists "own memorial read" on public.memorials;
create policy "own memorial read"
on public.memorials for select using(
  auth.uid()=user_id or exists(
    select 1 from public.profiles p
    where p.id=auth.uid() and p.is_admin
  )
);

drop policy if exists "own memory insert" on public.memories;
create policy "own memory insert"
on public.memories for insert with check(auth.uid()=user_id);

drop policy if exists "approved memory read" on public.memories;
create policy "approved memory read"
on public.memories for select using(
  status='approved'
  or auth.uid()=user_id
  or exists(
    select 1 from public.profiles p
    where p.id=auth.uid() and p.is_admin
  )
);

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