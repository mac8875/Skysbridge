# Mobile builds

Skysbridge packages the existing static website in a Capacitor shell. The mobile bundle is generated from the tracked site files. The Android launch animation is included only in the mobile bundle. The website build stages a separate `site-dist` directory without mobile-only assets.

## Build locally

1. Install Node.js 22 or later and the platform tools described in the Capacitor setup guide.
2. Run `npm ci`.
3. Run `npm run build:mobile`.
4. Run `npx cap add android` or `npx cap add ios` once, then `npx @capacitor/assets generate --android --ios` and `npx cap sync`.
5. Build from Android Studio or Xcode.

## GitHub Actions

`.github/workflows/mobile-build.yml` builds an Android debug APK and an iOS Simulator app on GitHub-hosted runners. Download either artifact from the completed Actions run. The iOS Simulator artifact cannot be installed on a physical iPhone.

These CI builds are unsigned development builds. Google Play releases and TestFlight uploads need platform signing configured in GitHub Actions secrets and an Apple App Store Connect upload key. Never commit signing keys or passwords.

The app uses the existing app identifier `org.skysbridge.app` to remain compatible with previous Android builds.
