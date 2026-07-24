-- Sky's Bridge v12 admin review centre
-- Adds reviewed timestamps and permits admins to read all profiles for request attribution.

alter table public.group_members add column if not exists reviewed_at timestamptz;
alter table public.group_members add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.memorials add column if not exists reviewed_at timestamptz;
alter table public.memorials add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.memories add column if not exists reviewed_at timestamptz;
alter table public.memories add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles" on public.profiles for select to authenticated using (public.is_admin());

create index if not exists group_members_pending_admin_idx on public.group_members(status,joined_at);
create index if not exists memorials_pending_admin_idx on public.memorials(approved,rejection_reason,created_at);
create index if not exists memories_pending_admin_idx on public.memories(approved,rejection_reason,created_at);
