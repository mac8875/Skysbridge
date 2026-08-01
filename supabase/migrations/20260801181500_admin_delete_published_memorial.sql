-- Skysbridge: restore permanent deletion of published memorial stars for administrators.
-- The fixed Sky star is not stored as a memorial and therefore cannot be deleted here.

begin;

create or replace function public.admin_delete_published_memorial(
  p_memorial_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_admin_id uuid := auth.uid();
  v_child_name text;
  v_rows integer := 0;
begin
  if v_admin_id is null then
    raise exception 'You must be logged in.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_admin_id
      and is_admin = true
  ) then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;

  select child_name
    into v_child_name
    from public.memorials
   where id = p_memorial_id
     and approved = true
     and public_requested = true;

  if not found then
    raise exception 'Published memorial not found.';
  end if;

  -- Hide any linked generated star record before the memorial is removed.
  -- This block is conditional so the migration also works on installations
  -- where the optional source_memorial_id column has not yet been created.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stars'
      and column_name = 'source_memorial_id'
  ) then
    execute $sql$
      update public.stars
         set is_public = false,
             source_memorial_id = null,
             updated_at = now()
       where source_memorial_id = $1
         and coalesce(is_featured, false) = false
         and coalesce(slug, '') <> 'sky'
    $sql$ using p_memorial_id;
  end if;

  delete from public.memorials
   where id = p_memorial_id;

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    raise exception 'The memorial no longer exists.';
  end if;

  return jsonb_build_object(
    'deleted', true,
    'id', p_memorial_id,
    'child_name', v_child_name
  );
end;
$$;

revoke all on function public.admin_delete_published_memorial(uuid) from public;
grant execute on function public.admin_delete_published_memorial(uuid) to authenticated;

commit;
