# Build and test the Skysbridge mobile app

The iOS and Android apps package the existing Skysbridge pages locally with Capacitor. They keep using the configured Supabase project; the browser client is bundled locally at the pinned package version for reproducible app builds. `native-assets/app-icon/skysbridge-sb-source.jpg` is the source artwork for the gold bridge-and-SB launcher icon; its Android and iOS native renditions live under `native-assets/` and are copied into generated native projects during sync. `www/`, `android/` and `ios/` are generated locally and ignored by Git.

## Requirements

- Node.js 22 or newer
- Android: Android Studio, Android SDK 36 / Build Tools 36, Java 21
- iOS: macOS with Xcode and iOS Simulator; a paid Apple Developer account is needed for signed device/App Store distribution

## Build locally

```sh
npm ci
npm run sync:mobile
npx cap open android
npx cap open ios
```

For an unsigned Android debug APK:

```sh
cd android
./gradlew assembleDebug
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

## Supabase Auth callback

In Supabase Dashboard, open **Authentication → URL Configuration** and add this exact Additional Redirect URL:

```text
skysbridge://auth/callback
```

Then set `NATIVE_AUTH_REDIRECT_URL` in `js/config.js` to `skysbridge://auth/callback` and rebuild. The initial app bundle leaves the setting blank, so the existing website redirect keeps signup functional until that Supabase setting is made. Once enabled, the app handles PKCE `code`, `token_hash` confirmation links and session-token callback links. No SQL migration or service-role key is needed.

## CI artifacts

The `Mobile builds` workflow builds an Android debug APK and an unsigned iOS Simulator app on the mobile branch. Download the artifacts from the corresponding GitHub Actions run. The iOS artifact is for the Simulator; publishing a signed IPA requires Apple signing credentials and App Store configuration.
