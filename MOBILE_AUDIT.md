# Skysbridge mobile technical audit

Audit baseline: `main` at `f46f9269c15f8f8b568d73033aba4f930b01994a` (19 October 2026).
Mobile work branch: `codex/capacitor-mobile-2026-10-19`.

## Existing architecture and features

- The product is a static, multilingual site (English, German and Spanish) with a responsive layout. Pages, scripts, styles and original artwork are in the repository root, `js/`, `css/` and `assets/`.
- The public Wall of Stars and remembrance pages read approved memorial data from Supabase. Members can submit memorials and memories for review, and approved photos use Supabase Storage.
- Supabase Auth supports email/password registration and sign-in. The member area supports protected support rooms, membership requests, member posts, and an administrator area for room, memorial and memory review. Existing moderation and admin actions remain in the original scripts.
- Professional-help pages currently provide curated third-party resources. The V35 release notes explicitly say the former therapist-request/invitation UI was removed; there is no active professional-support request flow in the current checked-in frontend. Existing Netlify functions use server environment variables for privileged credentials; those values are not copied into the app bundle.
- The site already publishes from repository root with Netlify. The mobile build therefore creates a separate `www/` bundle and leaves the website's deployment root and pages intact.

## Security and data findings

- `js/config.js` contains the Supabase project URL and a `sb_publishable_` key. These are client credentials intended for public apps; access must continue to be constrained by RLS.
- The checked-in migration history enables RLS on the application tables and includes owner/admin or approved-member policies. Supabase Storage policies restrict memorial-photo access to the intended user/member context.
- `netlify/functions/_shared.js` reads privileged values from environment variables and validates Auth tokens server-side. No service-role key was found in the frontend configuration.
- `npm audit --omit=dev` reports no production dependency vulnerabilities. The complete audit reports three moderate advisories in the build-only Capacitor CLI → `xcode` → `uuid` dependency chain; the native app bundle and Supabase production dependencies do not include that chain.
- The Netlify functions in this repository cover membership/memorial/memory notifications, room-message notices and administrator review. No Supabase Edge Function source for a therapist-matching workflow is present in this repository; any separately deployed historical function is outside this code audit.
- The repository has both a consolidated schema snapshot and a sequence of migrations. Use migrations as deployment history; do not treat the standalone schema dump as an instruction to reapply the database.
- Signup currently relies on the configured Supabase Auth site URL. A Capacitor app needs an additional callback URL allowlisted before email-confirmation links can reopen the app. No database migration is required for that Auth URL setting.

## Mobile implementation

- Capacitor wraps the existing pages locally rather than replacing their feature code. `npm run build:mobile` copies public site resources into ignored `www/`, bundles the pinned Supabase JS client and native runtime, and rewrites the app bundle to use the local client.
- The runtime can handle the `skysbridge://auth/callback` link and sets it as the signup confirmation redirect only when `NATIVE_AUTH_REDIRECT_URL` is configured. It is blank by default until Supabase allows that URL, which keeps the existing signup redirect working in the first build. Desktop and hosted website sign-up behavior is unchanged.
- The workflow builds an installable unsigned Android debug APK and an unsigned iOS Simulator app artifact. iOS distribution to physical devices/App Store still requires Apple signing credentials.

## Known verification limits and follow-up

- This development host has Node.js and Java but no Android SDK/Gradle installation and no Xcode, so platform compilation and device/simulator testing must run on the provided CI runners or the respective native IDEs.
- Add `skysbridge://auth/callback` under Supabase Auth → URL Configuration → Additional Redirect URLs, set `NATIVE_AUTH_REDIRECT_URL` in `js/config.js`, then rebuild. Test signup confirmation and relaunch on both platforms after the CI artifacts are produced.
- Validate the professional-help Netlify Function from the installed app with network access; it remains hosted and is not bundled into the native package.
