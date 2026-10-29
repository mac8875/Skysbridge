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
  path.join(root, 'mobile-assets/app-intro-background-v14.webp'),
  path.join(output, 'assets/app-intro-background-v14.webp')
);

function slowGifPlayback(input, factor) {
  const gif = Buffer.from(input);
  const signature = gif.subarray(0, 6).toString('ascii');
  if (signature !== 'GIF87a' && signature !== 'GIF89a') throw new Error('App intro asset is not a GIF');
  let offset = 13;
  const globalPacked = gif[10];
  if (globalPacked & 0x80) offset += 3 * (2 ** ((globalPacked & 0x07) + 1));
  let frames = 0;

  while (offset < gif.length) {
    const marker = gif[offset];
    if (marker === 0x3b) break;
    if (marker === 0x21) {
      const label = gif[offset + 1];
      offset += 2;
      if (label === 0xf9) {
        const blockSize = gif[offset++];
        if (blockSize !== 4) throw new Error('Unexpected GIF graphic-control block');
        offset += 1;
        const delay = gif.readUInt16LE(offset);
        if (delay > 0) gif.writeUInt16LE(Math.min(65535, Math.round(delay * factor)), offset);
        offset += 4;
      } else {
        while (offset < gif.length) {
          const size = gif[offset++];
          if (size === 0) break;
          offset += size;
        }
      }
      continue;
    }
    if (marker === 0x2c) {
      const imagePacked = gif[offset + 9];
      offset += 10;
      if (imagePacked & 0x80) offset += 3 * (2 ** ((imagePacked & 0x07) + 1));
      offset += 1;
      while (offset < gif.length) {
        const size = gif[offset++];
        if (size === 0) break;
        offset += size;
      }
      frames += 1;
      continue;
    }
    throw new Error(`Unexpected GIF block at byte ${offset}`);
  }

  if (!frames) throw new Error('App intro GIF contains no frames');
  return gif;
}

const introGif = await readFile(path.join(root, 'mobile-assets/skysbridge-app-intro-preview-v13.gif'));
await writeFile(
  path.join(output, 'assets/skysbridge-intro-bridge-stronger.gif'),
  slowGifPlayback(introGif, 1.18)
);

const entry = await stat(path.join(output, 'index.html')).catch(() => null);
if (!entry?.isFile()) throw new Error('Mobile web bundle is missing index.html');

const mobileIndexPath = path.join(output, 'index.html');
let mobileIndex = await readFile(mobileIndexPath, 'utf8');
const introBootstrap = `
  <link id="app-intro-stylesheet" rel="stylesheet" href="/css/app-intro.css?v=13">
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
console.log(`Prepared ${output} with early native intro cover`);
