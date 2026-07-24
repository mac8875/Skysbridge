# Sky's Bridge v12 — Admin review and email setup

The website now contains a real administrator review centre. Pending protected-room requests, memorials and memories are stored in Supabase and become visible only to a profile marked as an administrator.

## 1. Run the new Supabase migration
Run `supabase/migrations/20260725220000_admin_review_centre.sql` in the Supabase SQL Editor (or deploy migrations through your existing Supabase GitHub workflow).

## 2. Mark your login as administrator
Sign up/log in once with the email address you intend to use as administrator. Then run this in the Supabase SQL Editor, replacing the email where necessary:

```sql
update public.profiles
set is_admin = true
where id = (select id from auth.users where email = 'YOUR-LOGIN-EMAIL');
```

Log out and back in. The **Community review centre** will appear below the member area.

## 3. Configure email delivery in Netlify
In Netlify open **Site configuration → Environment variables** and add:

- `SUPABASE_URL` = `https://urlnadzbsccvtvijgyrs.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = your Supabase service-role key (never put this in `config.js`)
- `RESEND_API_KEY` = your Resend API key
- `ADMIN_EMAIL` = `together@skysbridge.org`
- `MAIL_FROM` = a verified sender, for example `Sky's Bridge <notifications@skysbridge.org>`

The domain used in `MAIL_FROM` must be verified with Resend. After adding variables, trigger a new Netlify deploy.

Without `RESEND_API_KEY`, requests still work and remain pending in Supabase; the dashboard can still approve or decline them, but no email is sent.

## Workflow
1. A member requests room access or submits a memorial/memory.
2. The request is saved as pending in Supabase.
3. Netlify sends an alert to `together@skysbridge.org`.
4. An administrator logs in and approves or declines it in the review centre.
5. The applicant receives the result by email.
