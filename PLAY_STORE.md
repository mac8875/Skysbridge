# Google Play preparation

## Draft listing

- **App name:** Sky’s Bridge — Skysbridge
- **Short description:** A quiet place to remember a child, preserve their story, and find understanding.
- **Category:** Lifestyle (confirm in Play Console)
- **Support email:** together@skysbridge.org
- **Website:** https://skysbridge.org/
- **Privacy policy:** https://skysbridge.org/privacy.html
- **Account deletion URL:** https://skysbridge.org/delete-account.html
- **App icon:** `play-store/app-icon-512.png` (512 × 512, 32-bit PNG)
- **Feature graphic:** `play-store/feature-graphic.jpg` (1024 × 500)
- **Package name:** `org.skysbridge.app`
- **Target SDK:** Android 16 / API 36

### Full description

Sky’s Bridge is a gentle, private place for families remembering a child who died.

Create a star in your child’s name and preserve a story, dates or an optional photo. You choose whether to request a place in the public sky. A person reviews public memorials before they appear. Photos are shown only to signed-in members after review.

The community offers protected spaces for parents who want to listen, share a memory or feel less alone. Access to these rooms is reviewed. Skysbridge is a community and remembrance space, not a therapy or emergency service.

You can explore public stars without an account. An account is needed to submit a memorial or request access to protected community rooms. Your submissions remain private unless you ask for publication. You can request deletion of your account and associated personal data from the member area or at skysbridge.org/delete-account.html.

Built with care for every family and every story.

## Data Safety draft — verify against the final release

The app uses Supabase Auth, Database and Storage. Based on the checked-in client flows, review these declarations in Play Console:

- **Email address:** collected for account creation, sign-in and account support.
- **User IDs / account data:** collected to manage profiles, memorial ownership and membership access.
- **User-generated content:** memorial names and stories, room posts, memories and optional photos may be stored. Some content can be published after the user requests publication and a human review; approved photos are restricted to signed-in members.
- **Sharing:** user content is disclosed to other users only in the visibility cases described above. Supabase processes data to provide the service; confirm the correct processor/third-party answers against current Supabase terms and the exact production configuration.
- **Security:** data is transmitted over HTTPS. No advertising SDK or analytics SDK was found in the app bundle source during this preparation.
- **Deletion:** users can start a request in the signed-in member area or at the account-deletion URL. Ensure requests are actually verified and completed, including relevant stored content, under the published retention policy.

Do not submit this draft without checking every declaration against Supabase project settings, email provider configuration, Netlify functions, and any production SDKs.

## Release setup

The native app uses package `org.skysbridge.app`, target API 36, and version `1.0.1` / code `2` so it can upgrade the existing debug install (version code 1). Play requires an Android App Bundle signed with the developer's upload key. Play App Signing should be enabled in the Play Console.

The manual GitHub Actions workflow **Android Play release bundle** expects these repository Actions secrets:

- `ANDROID_KEYSTORE_BASE64` — base64 of the upload `.jks` file
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Never commit the keystore or passwords. Create and back up the upload key securely, create the Play Console app with the exact package name, add the secrets, then run the workflow and upload `app-release.aab` to an internal/closed testing track first.

## Still required in Play Console

- Developer account, developer identity/contact verification, and app record.
- Store icon, feature graphic, and genuine phone screenshots in required dimensions.
- Content rating questionnaire, target audience, ads declaration, app access/reviewer instructions, and Data Safety form.
- Play App Signing, signed AAB, testing-track validation, and final policy review.
- If this is a personal developer account created after 13 November 2023, Google currently requires a closed test with at least 12 opted-in testers for 14 consecutive days before production access.

## Current review findings

- Target API 36 meets the current Google Play submission requirement for new apps and updates.
- Account deletion entry points were added to the signed-in member area and a public, multilingual request page. The actual deletion process remains an operator action by email and must be monitored and completed.
- No Play Console credentials or Android upload signing key are present in this repository/workspace, so a signed production AAB and store upload cannot yet be produced here.
