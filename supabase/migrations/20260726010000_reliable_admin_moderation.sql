-- Sky's Bridge v15: reliable admin moderation
-- Run this migration once in Supabase SQL Editor.
-- It provides a SECURITY DEFINER RPC so approved administrators can moderate
-- requests without requiring a Netlify service-role environment variable.

alter table public.group_members add column if not exists reviewed_at timestamptz;
alter table public.group_members add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.memorials add column if not exists reviewed_at timestamptz;
alter table public.memorials add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.memories add column if not exists reviewed_at timestamptz;
alter table public.memories add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

create or replace function public.review_community_request(
  p_request_type text,
  p_request_id text,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_admin_id uuid := auth.uid();
  v_group_id uuid;
  v_user_id uuid;
  v_rows integer := 0;
  v_reason text;
begin
  if v_admin_id is null then
    raise exception 'You must be logged in.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_admin_id and is_admin = true
  ) then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;

  if p_decision not in ('approve', 'decline') then
    raise exception 'Invalid moderation decision.';
  end if;

  v_reason := case
    when p_decision = 'decline' then left(coalesce(nullif(trim(p_reason), ''), 'Not approved at this time.'), 500)
    else null
  end;

  if p_request_type = 'membership' then
    begin
      v_group_id := split_part(p_request_id, ':', 1)::uuid;
      v_user_id := split_part(p_request_id, ':', 2)::uuid;
    exception when others then
      raise exception 'Invalid membership request identifier.';
    end;

    update public.group_members
       set status = case when p_decision = 'approve' then 'approved' else 'blocked' end,
           reviewed_at = now(),
           reviewed_by = v_admin_id
     where group_id = v_group_id
       and user_id = v_user_id
       and status = 'pending';
    get diagnostics v_rows = row_count;

  elsif p_request_type = 'memorial' then
    update public.memorials
       set approved = (p_decision = 'approve'),
           rejection_reason = v_reason,
           reviewed_at = now(),
           reviewed_by = v_admin_id,
           updated_at = now()
     where id = p_request_id::uuid
       and approved = false
       and rejection_reason is null;
    get diagnostics v_rows = row_count;

  elsif p_request_type = 'memory' then
    update public.memories
       set approved = (p_decision = 'approve'),
           rejection_reason = v_reason,
           reviewed_at = now(),
           reviewed_by = v_admin_id,
           updated_at = now()
     where id = p_request_id::uuid
       and approved = false
       and rejection_reason is null;
    get diagnostics v_rows = row_count;

  else
    raise exception 'Unknown request type.';
  end if;

  if v_rows = 0 then
    raise exception 'This request was already reviewed or no longer exists.';
  end if;

  return jsonb_build_object(
    'ok', true,
    'requestType', p_request_type,
    'requestId', p_request_id,
    'decision', p_decision,
    'reviewedBy', v_admin_id,
    'reviewedAt', now()
  );
end;
$$;

revoke all on function public.review_community_request(text, text, text, text) from public;
grant execute on function public.review_community_request(text, text, text, text) to authenticated;

create index if not exists group_members_pending_admin_idx on public.group_members(status, joined_at);
create index if not exists memorials_pending_admin_idx on public.memorials(approved, rejection_reason, created_at);
create index if not exists memories_pending_admin_idx on public.memories(approved, rejection_reason, created_at);
