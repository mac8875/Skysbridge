-- Let a signed-in visitor request family access directly from a private star.
create table if not exists public.memorial_family_requests (
  id uuid primary key default gen_random_uuid(),
  memorial_id uuid not null references public.memorials(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  requester_email text not null check (
    char_length(requester_email) between 5 and 254
    and requester_email = lower(btrim(requester_email))
    and requester_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  requester_name text not null check (char_length(requester_name) between 1 and 80),
  created_at timestamptz not null default now(),
  constraint memorial_family_requests_once_per_star unique (memorial_id, requester_user_id)
);

create index if not exists memorial_family_requests_requester_idx
  on public.memorial_family_requests (requester_user_id, created_at desc);
create index if not exists memorial_family_requests_memorial_idx
  on public.memorial_family_requests (memorial_id, created_at desc);

alter table public.memorial_family_requests enable row level security;
revoke all on public.memorial_family_requests from anon, authenticated, public;
grant select, insert, delete on public.memorial_family_requests to authenticated;

create policy memorial_family_requests_read_own_or_star_owner
on public.memorial_family_requests for select to authenticated
using (
  requester_user_id = auth.uid()
  or exists (
    select 1 from public.memorials m
    where m.id = memorial_id and m.user_id = auth.uid()
  )
);

create policy memorial_family_requests_create_for_private_star
on public.memorial_family_requests for insert to authenticated
with check (
  requester_user_id = auth.uid()
  and requester_email = lower(coalesce(auth.jwt() ->> 'email', ''))
  and exists (
    select 1 from public.memorials m
    where m.id = memorial_id
      and m.user_id <> auth.uid()
      and m.archived = false
      and m.rejection_reason is null
  )
);

create policy memorial_family_requests_delete_own_or_star_owner
on public.memorial_family_requests for delete to authenticated
using (
  requester_user_id = auth.uid()
  or exists (
    select 1 from public.memorials m
    where m.id = memorial_id and m.user_id = auth.uid()
  )
);
