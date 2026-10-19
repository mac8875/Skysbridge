import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function addPlatform(platform) {
  if (existsSync(path.join(root, platform))) return;
  const result = spawnSync(npx, ['cap', 'add', platform], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

addPlatform('android');
addPlatform('ios');

const manifestPath = path.join(root, 'android/app/src/main/AndroidManifest.xml');
let manifest = readFileSync(manifestPath, 'utf8');
if (!manifest.includes('android:scheme="skysbridge"')) {
  manifest = manifest.replace('</activity>', `            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="skysbridge" android:host="auth" />\n            </intent-filter>\n        </activity>`);
  writeFileSync(manifestPath, manifest);
}

// Keep generated Android projects ready for a Play release without checking in
// signing credentials. CI supplies the upload key only through protected secrets.
const androidBuildPath = path.join(root, 'android/app/build.gradle');
let androidBuild = readFileSync(androidBuildPath, 'utf8');
androidBuild = androidBuild.replace(/versionCode\s+\d+/, 'versionCode 2');
androidBuild = androidBuild.replace(/versionName\s+"[^"]*"/, 'versionName "1.0.1"');
if (!androidBuild.includes('def playUploadKeyReady')) {
  androidBuild = `def playUploadKeyReady = System.getenv('ANDROID_KEYSTORE_PATH') && System.getenv('ANDROID_KEYSTORE_PASSWORD') && System.getenv('ANDROID_KEY_ALIAS') && System.getenv('ANDROID_KEY_PASSWORD')\n\n${androidBuild}`;
}
if (!androidBuild.includes('signingConfigs {')) {
  androidBuild = androidBuild.replace('android {', `android {
    signingConfigs {
        release {
            if (playUploadKeyReady) {
                storeFile file(System.getenv('ANDROID_KEYSTORE_PATH'))
                storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
                keyAlias System.getenv('ANDROID_KEY_ALIAS')
                keyPassword System.getenv('ANDROID_KEY_PASSWORD')
            }
        }
    }`);
}
if (!androidBuild.includes('if (playUploadKeyReady) signingConfig signingConfigs.release')) {
  androidBuild = androidBuild.replace('release {\n            minifyEnabled false', `release {
            if (playUploadKeyReady) signingConfig signingConfigs.release
            minifyEnabled false`);
}
writeFileSync(androidBuildPath, androidBuild);

const plistPath = path.join(root, 'ios/App/App/Info.plist');
let plist = readFileSync(plistPath, 'utf8');
if (!plist.includes('<key>CFBundleURLTypes</key>')) {
  const closingDict = plist.lastIndexOf('</dict>');
  if (closingDict < 0) throw new Error('Could not locate the Info.plist root dictionary.');
  plist = `${plist.slice(0, closingDict)}\t<key>CFBundleURLTypes</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>CFBundleURLName</key>\n\t\t\t<string>org.skysbridge.app.auth</string>\n\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n\t\t\t\t<string>skysbridge</string>\n\t\t\t</array>\n\t\t</dict>\n\t</array>\n${plist.slice(closingDict)}`;
  writeFileSync(plistPath, plist);
}
