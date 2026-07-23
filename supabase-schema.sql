-- Run this in Supabase SQL Editor.
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

alter table public.memorials enable row level security;

create policy "Members can create their own memorials"
on public.memorials for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Members can read their own memorials"
on public.memorials for select
to authenticated
using (auth.uid() = user_id);

create policy "Anyone can read approved memorials"
on public.memorials for select
to anon, authenticated
using (approved = true and public_requested = true);

create policy "Members can update their own unapproved memorials"
on public.memorials for update
to authenticated
using (auth.uid() = user_id and approved = false)
with check (auth.uid() = user_id);

create policy "Members can delete their own memorials"
on public.memorials for delete
to authenticated
using (auth.uid() = user_id);
