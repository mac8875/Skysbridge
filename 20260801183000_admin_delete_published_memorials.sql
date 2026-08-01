-- Skysbridge V36
-- Reliable administrator deletion of published memorial stars.
-- Safe to run more than once.

-- Keep the existing RLS route available for authenticated administrators.
grant usage on schema public to authenticated;
grant select, delete on table public.memorials to authenticated;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "Administrators can delete memorials" on public.memorials;
create policy "Administrators can delete memorials"
on public.memorials
for delete
to authenticated
using (public.is_admin());

-- A dedicated server-side operation makes the frontend deletion deterministic
-- and still checks the signed-in user's administrator profile.
create or replace function public.admin_delete_published_memorial(
  p_memorial_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  delete from public.memorials
  where id = p_memorial_id
    and approved = true
    and public_requested = true;

  get diagnostics deleted_count = row_count;
  return deleted_count = 1;
end;
$$;

revoke all on function public.admin_delete_published_memorial(uuid) from public;
grant execute on function public.admin_delete_published_memorial(uuid) to authenticated;

-- Ask Supabase/PostgREST to refresh the function schema promptly.
notify pgrst, 'reload schema';
