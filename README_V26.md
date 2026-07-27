# Skysbridge V26 — Administrator and Protected Rooms

This upgrade adds the missing community functions from V25.

## Important

This package intentionally does NOT contain `js/config.js`.
Your working Supabase key will therefore not be overwritten.

## Upload

Upload these files into the existing GitHub repository and replace the old versions:

- `index.html`
- `css/styles.css`
- `js/app.js`
- `supabase/migrations/20260727150000_skysbridge_v26_admin_rooms.sql`

Commit message:

`Add V26 administrator and protected rooms`

## Supabase migration

Open Supabase > SQL Editor and run the complete contents of:

`supabase/migrations/20260727150000_skysbridge_v26_admin_rooms.sql`

## Make your own account administrator

Run this separately in Supabase SQL Editor, replacing the email with your login email:

```sql
update public.profiles
set is_admin = true
where id = (
  select id
  from auth.users
  where lower(email) = lower('YOUR_EMAIL_ADDRESS')
);
```

Then sign out of Skysbridge and sign in again.

## Administrator room access

An administrator can request access to any room and is approved immediately.
Normal users create a pending request which appears in the administrator dashboard.
