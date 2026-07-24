# Sky's Bridge v11 Community

A protected memorial and community platform for families after the loss of a child.

## Functional community features

- Supabase email registration and login
- Chosen community display name
- Personal memorial-submission status
- Protected support-room directory
- Membership access requests
- Approved-member-only room conversations
- Private posts protected by Row Level Security
- Public Wall of Stars after moderation
- Responsive mobile and desktop design

## Deploy through GitHub

1. Upload the complete contents of this folder to the root of `mac8875/Skysbridge`.
2. Commit the files to the production branch connected to Netlify and Supabase.
3. Netlify publishes the site from the repository root.
4. Supabase applies `supabase/migrations/20260725010000_community_functions.sql`.

Read `COMMUNITY_SETUP.txt` for the current manual room-approval process.

## Security

`config.js` contains only a publishable browser key. Never commit a secret or service-role key. Room membership and post access are protected by Supabase Row Level Security.


## v12 administrator workflow
This version adds a protected administrator review centre and optional transactional email notifications through Netlify Functions + Resend. Read `ADMIN_EMAIL_SETUP.md` before deployment.
