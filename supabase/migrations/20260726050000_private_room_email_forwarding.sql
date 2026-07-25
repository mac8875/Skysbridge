-- Sky's Bridge v18: optional email forwarding for selected protected rooms
-- Run once in Supabase SQL Editor after deploying Version 18.

alter table public.support_groups
  add column if not exists forward_messages_to_email boolean not null default false;

alter table public.support_groups
  add column if not exists forwarding_notice text not null default
  'Messages in this room are also sent securely to the Sky''s Bridge Microsoft 365 support mailbox for professional review and possible forwarding to the treating clinician.';

alter table public.group_posts
  add column if not exists email_forwarded_at timestamptz;

-- Enable forwarding only for the room(s) you explicitly choose.
-- Replace the slug below if you want a different room.
update public.support_groups
set forward_messages_to_email = true
where slug = 'newly-bereaved';

create index if not exists group_posts_email_forwarding_idx
on public.group_posts (group_id, email_forwarded_at, created_at desc);
