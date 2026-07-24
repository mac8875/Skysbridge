-- Sky's Bridge v11 — functional protected community rooms

alter table public.group_posts
  add column if not exists author_name text not null default 'Community member'
  check (char_length(author_name) between 1 and 80);

create index if not exists group_posts_group_created_idx
  on public.group_posts (group_id, created_at desc);

create index if not exists group_members_user_status_idx
  on public.group_members (user_id, status);

-- Moderators may hide posts in rooms they moderate; administrators retain full control.
drop policy if exists "Moderators can hide room posts" on public.group_posts;
create policy "Moderators can hide room posts"
on public.group_posts for update to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.group_members gm
    where gm.group_id = group_posts.group_id
      and gm.user_id = auth.uid()
      and gm.role = 'moderator'
      and gm.status = 'approved'
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.group_members gm
    where gm.group_id = group_posts.group_id
      and gm.user_id = auth.uid()
      and gm.role = 'moderator'
      and gm.status = 'approved'
  )
);
