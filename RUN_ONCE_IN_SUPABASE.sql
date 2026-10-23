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

-- Secure deletion for administrator-managed private anonymous stars.
create or replace function public.admin_delete_private_memorial(
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
    and public_requested = false;

  get diagnostics deleted_count = row_count;
  return deleted_count = 1;
end;
$$;

revoke all on function public.admin_delete_private_memorial(uuid) from public;
grant execute on function public.admin_delete_private_memorial(uuid) to authenticated;

notify pgrst, 'reload schema';

-- Public wall stars always show the child's name; remembrance details remain protected.
drop policy if exists "Guests can see anonymous active star shapes" on public.memorials;
drop policy if exists "Guests can see active wall stars with names" on public.memorials;
create policy "Guests can see active wall stars with names"
on public.memorials for select to anon
using (
  archived = false
  and rejection_reason is null
  and (public_requested = false or (public_requested = true and approved = true))
);

grant select (id, child_name, star_style, public_requested, approved)
on public.memorials to anon;

notify pgrst, 'reload schema';


-- Let each signed-in parent switch their own star between private and public.
-- Public requests always return to moderation; switching private takes effect immediately.
create or replace function public.set_memorial_visibility(p_memorial_id uuid, p_public boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  changed boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Sign in is required to update this star';
  end if;

  update public.memorials
  set public_requested = p_public,
      approved = case when p_public then false else approved end,
      rejection_reason = case when p_public then null else rejection_reason end,
      updated_at = now()
  where id = p_memorial_id
    and user_id = auth.uid()
    and archived = false
    and rejection_reason is null
  returning true into changed;

  if not coalesce(changed, false) then
    raise exception 'Star not found or not available to this account';
  end if;

  return true;
end;
$$;

revoke all on function public.set_memorial_visibility(uuid, boolean) from public;
revoke all on function public.set_memorial_visibility(uuid, boolean) from anon;
grant execute on function public.set_memorial_visibility(uuid, boolean) to authenticated;
notify pgrst, 'reload schema';
