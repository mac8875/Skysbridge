import { cp, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sources = [
  [
    path.join(root, 'native-assets/android-icons/res'),
    path.join(root, 'android/app/src/main/res'),
  ],
  [
    path.join(root, 'native-assets/ios-icons/Assets.xcassets/AppIcon.appiconset'),
    path.join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset'),
  ],
];

for (const [source, destination] of sources) {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await cp(from, to, { recursive: true, force: true });
    } else {
      await cp(from, to);
    }
  }
}

console.log('Applied the Skysbridge launcher icons to Android and iOS.');
