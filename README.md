# Sky's Bridge

A protected memorial and community platform for families after the loss of a child.

## Current foundation

- Responsive public website
- Sky's interactive memorial story
- Email registration and login with Supabase Auth
- Private memorial submissions
- Public Wall of Stars entries after approval
- Private memory submissions for Sky
- Row Level Security policies
- Netlify configuration
- Supabase migration workflow through GitHub

## Project structure

- `index.html`, `styles.css`, `script.js` — website
- `config.js` — public Supabase browser configuration
- `supabase/migrations/` — database migrations applied through Supabase GitHub integration
- `community-guidelines.html`, `privacy.html` — policy pages
- `netlify.toml` — Netlify deployment and security headers

## Deploy through GitHub

1. Upload the complete contents of this folder to the root of `mac8875/Skysbridge`.
2. Commit the files to the branch connected to Supabase and Netlify.
3. In Supabase > Integrations > GitHub, keep the working directory set to `.`.
4. Merge the changes into the configured production branch.
5. Supabase detects the migration under `supabase/migrations/` and applies it to the production database.
6. Netlify publishes the website from the repository root.

## Supabase authentication URLs

Set in Supabase > Authentication > URL Configuration:

- Site URL: `https://skysbridge.org`
- Redirect URLs:
  - `https://skysbridge.org`
  - `https://www.skysbridge.org`

## Moderation

Until the dedicated admin dashboard is added, review content in Supabase Table Editor:

- `memorials`: set `approved` to `true` after review.
- `memories`: set `approved` to `true` after review.

## Security

`config.js` contains only a publishable browser key. Never commit a secret key or service-role key. Database access is protected by Row Level Security.

## Next development phases

1. Family profiles and memorial editing
2. Photo uploads with Supabase Storage
3. Dedicated moderation dashboard
4. Protected support rooms and posts
5. Email notifications
6. Donations through a regulated payment provider
