# Skysbridge V25 Upgrade

This is the first stable step toward V32.

## Included
- Premium homepage using the selected Skysbridge logo
- Sky as the first featured star
- Marco's story, including the respectful wording about the couple's paths separating
- Responsive mobile design
- Supabase login and registration
- Private memorial submissions
- Moderated memory submissions
- Privacy and community-guidelines pages
- Row Level Security migration
- Netlify security headers

## Upload to the existing GitHub repository

1. Download and unzip this package.
2. Upload the contents into the root of the existing Skysbridge repository.
3. Replace files when GitHub asks.
4. Do not upload the ZIP itself into the repository.
5. Commit with:
   `Upgrade Skysbridge to V25 foundation`
6. Netlify should redeploy automatically.

## Supabase

1. Open `js/config.js`.
2. Replace `PASTE_YOUR_SUPABASE_ANON_KEY_HERE` with the public anon key from Supabase.
3. Run:
   `supabase/migrations/20260727093000_skysbridge_v25.sql`
   in the Supabase SQL Editor.

Never place the service-role key in the website.
