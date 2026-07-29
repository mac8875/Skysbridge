# Skysbridge Version 32

This package repairs the active frontend and restores the remembrance features to the live homepage.

## Included

- Full Skysbridge wordmark in the header and footer
- Brighter premium navy palette
- Responsive Wall of Stars memorial cards
- Approved public memorials loaded from Supabase
- SVG remembrance candles
- Optional birth and passing dates
- Birthday and passing-anniversary highlighting
- Search and sorting
- Existing authentication, protected rooms, administration and professional-support functions

## Upload to GitHub

Upload the complete contents of this folder into the root of the existing Skysbridge repository and replace matching files.

Suggested commit message:

`Restore memorial candles and brighten Skysbridge V32`

Netlify should redeploy automatically.

## Supabase

No new migration is required when `supabase/migrations/20260726093000_memorial_dates_and_annual_tributes.sql` has already been executed. If the date fields have not yet been added, run that migration once in the Supabase SQL Editor. The page also includes a safe fallback so memorial submission and display continue without the optional dates.

Never place a Supabase service-role key in frontend files.
