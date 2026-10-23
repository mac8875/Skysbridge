-- Memory visibility follows the star's visibility and family access.
-- A former contributor cannot keep reading a pending memory just because they created its row.
drop policy if exists "Members can read their own memories" on public.memories;
create policy "Admins can read memories for moderation"
on public.memories for select to authenticated
using (is_admin());

notify pgrst, 'reload schema';
