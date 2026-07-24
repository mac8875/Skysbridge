-- SKY'S BRIDGE SUPABASE SETUP
-- Run this complete file once in Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.memorials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  child_name text not null check (char_length(child_name) between 1 and 80),
  remembrance text default '' check (char_length(remembrance) <= 500),
  public_requested boolean not null default false,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  star_slug text not null default 'sky' check (char_length(star_slug) between 1 and 80),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 80),
  message text not null check (char_length(message) between 1 and 800),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.memorials enable row level security;
alter table public.memories enable row level security;

drop policy if exists "Members can create their own memorials" on public.memorials;
create policy "Members can create their own memorials"
on public.memorials for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Members can read their own memorials" on public.memorials;
create policy "Members can read their own memorials"
on public.memorials for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Anyone can read approved memorials" on public.memorials;
create policy "Anyone can read approved memorials"
on public.memorials for select to anon, authenticated
using (approved = true and public_requested = true);

drop policy if exists "Members can update their own unapproved memorials" on public.memorials;
create policy "Members can update their own unapproved memorials"
on public.memorials for update to authenticated
using (auth.uid() = user_id and approved = false)
with check (auth.uid() = user_id);

drop policy if exists "Members can delete their own memorials" on public.memorials;
create policy "Members can delete their own memorials"
on public.memorials for delete to authenticated
using (auth.uid() = user_id);

drop policy if exists "Members can submit memories" on public.memories;
create policy "Members can submit memories"
on public.memories for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Members can read their own memories" on public.memories;
create policy "Members can read their own memories"
on public.memories for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Anyone can read approved memories" on public.memories;
create policy "Anyone can read approved memories"
on public.memories for select to anon, authenticated
using (approved = true);

create index if not exists memorials_public_idx
on public.memorials (approved, public_requested, created_at desc);

create index if not exists memories_star_idx
on public.memories (star_slug, approved, created_at desc);
