import { cp, mkdir, readdir, rm, stat, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'www');
const icon = await sharp(path.join(root, 'assets/icon-source.jpg'))
  .resize(1024, 1024, { fit: 'cover' })
  .png()
  .toBuffer();
await Promise.all([
  writeFile(path.join(root, 'assets/icon-only.png'), icon),
  writeFile(path.join(root, 'assets/icon-foreground.png'), icon),
  sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#061827' } })
    .png()
    .toFile(path.join(root, 'assets/icon-background.png')),
]);
const excludedDirectories = new Set([
  '.git', '.github', '.netlify', 'android', 'ios', 'node_modules', 'supabase', 'www', 'mobile-assets'
]);
const excludedFiles = new Set([
  'capacitor.config.json', 'package.json', 'package-lock.json', 'README.md', 'README.txt', 'skysbridge-android.apk'
]);
const excludedExtensions = new Set(['.md', '.sql', '.txt']);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
async function copyPublicFiles(source, destination) {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const name = entry.name;
    if (name.startsWith('.') || excludedDirectories.has(name) || excludedFiles.has(name)) continue;
    if (!entry.isDirectory() && (excludedExtensions.has(path.extname(name).toLowerCase()) || name.startsWith('DEPLOY_VERSION_'))) continue;
    const from = path.join(source, name);
    const to = path.join(destination, name);
    if (entry.isDirectory()) await copyPublicFiles(from, to);
    else await cp(from, to);
  }
}

await copyPublicFiles(root, output);
await mkdir(path.join(output, 'assets'), { recursive: true });
await cp(
  path.join(root, 'mobile-assets/skysbridge-app-intro-preview-v13.gif'),
  path.join(output, 'assets/skysbridge-intro-bridge-stronger.gif')
);
const introAnimation = path.join(output, 'assets/skysbridge-intro-bridge-stronger.gif');
if ((await stat(introAnimation)).size === 0) throw new Error('Mobile intro animation was copied as an empty file');

const entry = await stat(path.join(output, 'index.html')).catch(() => null);
if (!entry?.isFile()) throw new Error('Mobile web bundle is missing index.html');

const mobileIndexPath = path.join(output, 'index.html');
let mobileIndex = await readFile(mobileIndexPath, 'utf8');
const introBootstrap = `
  <link id="app-intro-stylesheet" rel="stylesheet" href="/css/app-intro.css?v=7">
  <style>
    html.skysbridge-intro-pending,html.skysbridge-intro-pending body{background:#020914!important}
    html.skysbridge-intro-pending body>:not(.app-intro){visibility:hidden!important}
  </style>
  <script>
    (() => {
      const c = window.Capacitor;
      const native = Boolean(c?.isNativePlatform?.() || ['android','ios'].includes(c?.getPlatform?.()) ||
        ['localhost','127.0.0.1'].includes(location.hostname.toLowerCase()) ||
        ['capacitor:','ionic:'].includes(location.protocol) || /\\bCapacitor\\b/i.test(navigator.userAgent));
      if (native) document.documentElement.classList.add('skysbridge-native');
      if (!native) return;
      try { if (sessionStorage.getItem('skysbridge-intro-shown') === '1') return; } catch {}
      document.documentElement.classList.add('skysbridge-intro-pending');
      setTimeout(() => document.documentElement.classList.remove('skysbridge-intro-pending'), 15000);
    })();
  </script>`;
if (!/<head[^>]*>/i.test(mobileIndex)) throw new Error('Mobile index is missing its head element');
mobileIndex = mobileIndex.replace(/<head[^>]*>/i, match => match + introBootstrap);
await writeFile(mobileIndexPath, mobileIndex);

// Keep the APK's typography independent from the public website layout.
async function addNativeTypography(source) {
  const nativeMarker = `<script>
    (() => {
      const c = window.Capacitor;
      const native = Boolean(c?.isNativePlatform?.() || ['android','ios'].includes(c?.getPlatform?.()) ||
        ['localhost','127.0.0.1'].includes(location.hostname.toLowerCase()) ||
        ['capacitor:','ionic:'].includes(location.protocol) || /\\bCapacitor\\b/i.test(navigator.userAgent));
      if (native) document.documentElement.classList.add('skysbridge-native');
    })();
  </script>`;
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const file = path.join(source, entry.name);
    if (entry.isDirectory()) {
      await addNativeTypography(file);
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.html') {
      let html = await readFile(file, 'utf8');
      const link = '<link rel="stylesheet" href="/css/native-app-typography.css?v=4">';
      if (!html.includes('native-app-typography.css') && /<\/head>/i.test(html)) {
        html = html.replace(/<\/head>/i, `${link}\n</head>`);
      }
      if (!html.includes("classList.add('skysbridge-native')") && /<head[^>]*>/i.test(html)) {
        html = html.replace(/<head[^>]*>/i, match => `${match}\n${nativeMarker}`);
      }
      await writeFile(file, html);
    }
  }
}
await addNativeTypography(output);
console.log(`Prepared ${output} with early native intro cover`);
