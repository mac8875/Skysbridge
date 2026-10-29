import { cp, mkdir, mkdtemp, readdir, rm, stat, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);

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

async function prepareIntroStar(input, factor, outputPath) {
  const metadata = await sharp(input, { animated: true }).metadata();
  if (metadata.format !== 'gif' || !metadata.pages || !metadata.pageHeight) {
    throw new Error('App intro asset is not an animated GIF');
  }

  const frameHeight = metadata.pageHeight;
  const frameWidth = metadata.width;
  const frameCount = metadata.pages;
  const delays = metadata.delay || Array(frameCount).fill(100);
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'skysbridge-intro-'));
  const concatPath = path.join(temporaryDirectory, 'frames.ffconcat');
  const framePaths = [];

  try {
    for (let frame = 0; frame < frameCount; frame += 1) {
      const decoded = await sharp(input, { page: frame })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const { data, info } = decoded;

      if (frame >= 16 && frame <= 55) {
        let brightestIndex = -1;
        let brightestScore = -1;
        let brightestX = 0;
        let brightestY = 0;
        const skyLimit = Math.floor(frameHeight * 0.42);

        for (let y = 0; y < skyLimit; y += 2) {
          for (let x = 0; x < frameWidth; x += 2) {
            const pixel = (y * frameWidth + x) * info.channels;
            const red = data[pixel];
            const green = data[pixel + 1];
            const blue = data[pixel + 2];
            if (data[pixel + 3] < 180 || red < 175 || red - blue < 35 || green - blue < 12) continue;
            const score = red + green * 0.65 - blue * 0.25;
            if (score > brightestScore) {
              brightestScore = score;
              brightestIndex = pixel;
              brightestX = x;
              brightestY = y;
            }
          }
        }

        if (brightestIndex >= 0) {
          const radius = 32;
          const radiusSquared = radius * radius;
          const left = Math.max(0, brightestX - radius);
          const right = Math.min(frameWidth - 1, brightestX + radius);
          const top = Math.max(0, brightestY - radius);
          const bottom = Math.min(skyLimit - 1, brightestY + radius);

          for (let y = top; y <= bottom; y += 1) {
            for (let x = left; x <= right; x += 1) {
              const dx = x - brightestX;
              const dy = y - brightestY;
              const distanceSquared = dx * dx + dy * dy;
              if (distanceSquared > radiusSquared) continue;
              const pixel = (y * frameWidth + x) * info.channels;
              const falloff = Math.exp(-distanceSquared / (2 * 18 * 18));
              data[pixel] = Math.min(255, data[pixel] + 13 * falloff);
              data[pixel + 1] = Math.min(255, data[pixel + 1] + 8 * falloff);
              data[pixel + 2] = Math.min(255, data[pixel + 2] + 3 * falloff);
              if (distanceSquared < 13 * 13) {
                data[pixel] = Math.min(255, data[pixel] * 1.08);
                data[pixel + 1] = Math.min(255, data[pixel + 1] * 1.06);
              }
            }
          }
        }
      }

      const framePath = path.join(temporaryDirectory, `frame-${String(frame).padStart(3, '0')}.png`);
      await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
        .png()
        .toFile(framePath);
      framePaths.push(framePath);
    }

    const concatLines = ['ffconcat version 1.0'];
    framePaths.forEach((framePath, frame) => {
      const delay = delays[frame] || 100;
      const adjustedDelay = frame >= 16 && frame <= 55 ? Math.round(delay * factor) : delay;
      concatLines.push(`file '${framePath}'`);
      concatLines.push(`duration ${(adjustedDelay / 1000).toFixed(3)}`);
    });
    concatLines.push(`file '${framePaths.at(-1)}'`);
    await writeFile(concatPath, concatLines.join('\n'));

    await execFileAsync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'concat', '-safe', '0', '-i', concatPath,
      '-filter_complex', '[0:v]split[base][paletteSource];[paletteSource]palettegen=stats_mode=full[palette];[base][palette]paletteuse=dither=sierra2_4a',
      '-fps_mode', 'vfr',
      '-loop', String(metadata.loop ?? 0),
      outputPath,
    ], { maxBuffer: 10 * 1024 * 1024 });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

const introGif = path.join(root, 'mobile-assets/skysbridge-app-intro-preview-v13.gif');
await prepareIntroStar(
  introGif,
  1.45,
  path.join(output, 'assets/skysbridge-intro-bridge-stronger.gif')
);

const entry = await stat(path.join(output, 'index.html')).catch(() => null);
if (!entry?.isFile()) throw new Error('Mobile web bundle is missing index.html');

const mobileIndexPath = path.join(output, 'index.html');
let mobileIndex = await readFile(mobileIndexPath, 'utf8');
const introBootstrap = `
  <link id="app-intro-stylesheet" rel="stylesheet" href="/css/app-intro.css?v=15">
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
