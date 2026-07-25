-- Sky's Bridge v17: post-approval content management
-- Run once in Supabase SQL Editor after deploying Version 17.

alter table public.memorials add column if not exists archived boolean not null default false;
alter table public.memories add column if not exists archived boolean not null default false;

create or replace function public.admin_manage_content(
  p_content_type text,
  p_content_id uuid,
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_admin_id uuid := auth.uid();
  v_rows integer := 0;
  v_reason text := left(coalesce(nullif(trim(p_reason), ''), 'Removed from public view by an administrator.'), 500);
begin
  if v_admin_id is null then
    raise exception 'You must be logged in.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_admin_id and is_admin = true) then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  if p_content_type not in ('memorial','memory') then raise exception 'Unknown content type.'; end if;
  if p_action not in ('archive','restore','reject','approve','delete') then raise exception 'Unknown action.'; end if;

  if p_content_type = 'memorial' then
    if p_action = 'delete' then
      delete from public.memorials where id = p_content_id;
    elsif p_action = 'archive' then
      update public.memorials set archived=true, updated_at=now(), reviewed_at=now(), reviewed_by=v_admin_id where id=p_content_id;
    elsif p_action = 'restore' then
      update public.memorials set archived=false, updated_at=now(), reviewed_at=now(), reviewed_by=v_admin_id where id=p_content_id;
    elsif p_action = 'reject' then
      update public.memorials set approved=false, archived=false, rejection_reason=v_reason, updated_at=now(), reviewed_at=now(), reviewed_by=v_admin_id where id=p_content_id;
    elsif p_action = 'approve' then
      update public.memorials set approved=true, archived=false, rejection_reason=null, updated_at=now(), reviewed_at=now(), reviewed_by=v_admin_id where id=p_content_id;
    end if;
  else
    if p_action = 'delete' then
      delete from public.memories where id = p_content_id;
    elsif p_action = 'archive' then
      update public.memories set archived=true, updated_at=now(), reviewed_at=now(), reviewed_by=v_admin_id where id=p_content_id;
    elsif p_action = 'restore' then
      update public.memories set archived=false, updated_at=now(), reviewed_at=now(), reviewed_by=v_admin_id where id=p_content_id;
    elsif p_action = 'reject' then
      update public.memories set approved=false, archived=false, rejection_reason=v_reason, updated_at=now(), reviewed_at=now(), reviewed_by=v_admin_id where id=p_content_id;
    elsif p_action = 'approve' then
      update public.memories set approved=true, archived=false, rejection_reason=null, updated_at=now(), reviewed_at=now(), reviewed_by=v_admin_id where id=p_content_id;
    end if;
  end if;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'The item no longer exists.'; end if;
  return jsonb_build_object('ok',true,'contentType',p_content_type,'contentId',p_content_id,'action',p_action);
end;
$$;

revoke all on function public.admin_manage_content(text,uuid,text,text) from public;
grant execute on function public.admin_manage_content(text,uuid,text,text) to authenticated;

create index if not exists memorials_admin_manage_idx on public.memorials(archived, approved, created_at desc);
create index if not exists memories_admin_manage_idx on public.memories(archived, approved, created_at desc);
