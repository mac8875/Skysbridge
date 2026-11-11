-- Tie the shared Sky wall star to the account that owns its family circle.
-- This keeps attached memory photos private while allowing accepted family members to read them.
do $$
declare
  family_owner_id uuid;
begin
  select id
    into family_owner_id
  from auth.users
  where lower(email) = 'mac8875@web.de'
    and email_confirmed_at is not null
  limit 1;

  if family_owner_id is null then
    raise exception 'Could not find the confirmed Skysbridge family owner account';
  end if;

  update public.stars
  set created_by = family_owner_id,
      updated_at = now()
  where slug = 'sky'
    and created_by is null;

  if not exists (
    select 1 from public.stars where slug = 'sky' and created_by = family_owner_id
  ) then
    raise exception 'Could not associate the Sky wall star with its family owner';
  end if;
end
$$;

notify pgrst, 'reload schema';
