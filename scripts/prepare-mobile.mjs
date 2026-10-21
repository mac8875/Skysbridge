import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'www');
await sharp(path.join(root, 'assets/icon-source.jpg'))
  .resize(1024, 1024, { fit: 'cover' })
  .png()
  .toFile(path.join(root, 'assets/icon-only.png'));
const excludedDirectories = new Set([
  '.git', '.github', '.netlify', 'android', 'ios', 'mobile', 'node_modules', 'site-dist', 'supabase', 'www'
]);
const excludedFiles = new Set([
  'capacitor.config.json', 'package.json', 'package-lock.json', 'README.md', 'README.txt'
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

// The launch animation is app-only: keep its source out of both website
// publishing and the ordinary static-file copy, then add it to the mobile bundle.
const mobileIntro = path.join(root, 'mobile', 'intro');
const appVersion = (await readFile(path.join(mobileIntro, 'APP_VERSION'), 'utf8')).trim();
if (!/^\d+\.\d+\.\d+$/.test(appVersion)) throw new Error(`Invalid app version: ${appVersion}`);
await mkdir(path.join(output, 'assets'), { recursive: true });
await cp(path.join(mobileIntro, 'skysbridge-intro.mp4'), path.join(output, 'assets', 'skysbridge-intro.mp4'));
await cp(path.join(mobileIntro, 'app-intro.js'), path.join(output, 'js', 'app-intro.js'));

const versionLabels = {
  'index.html': 'App version',
  'index-de.html': 'App-Version',
  'index-es.html': 'Versión de la app'
};
for (const [page, label] of Object.entries(versionLabels)) {
  const pagePath = path.join(output, page);
  let pageHtml = await readFile(pagePath, 'utf8');
  const versionLine = /(<p class="site-version"[^>]*>)[\s\S]*?(<\/p>)/;
  if (!versionLine.test(pageHtml)) throw new Error(`Could not locate the version footer in ${page}`);
  pageHtml = pageHtml.replace(versionLine, `$1${label} ${appVersion}$2`);
  await writeFile(pagePath, pageHtml);
}

const mobileIndex = path.join(output, 'index.html');
let html = await readFile(mobileIndex, 'utf8');
const headEnd = html.indexOf('</head>');
const bodyOpen = html.match(/<body(?:\s[^>]*)?>/i)?.[0];
if (headEnd < 0 || !bodyOpen) throw new Error('Could not locate the mobile index head and body');
const introHead = `
  <style id="skysbridge-app-intro-style">
    #skysbridge-app-intro { position: fixed; inset: 0; z-index: 2147483647; overflow: hidden; background: #020b16; opacity: 1; transition: opacity 800ms ease; }
    #skysbridge-app-intro video { display: block; width: 100%; height: 100%; object-fit: cover; }
    #skysbridge-app-intro.is-fading { opacity: 0; pointer-events: none; }
    @media (prefers-reduced-motion: reduce) { #skysbridge-app-intro { transition-duration: 300ms; } }
  </style>
  <script src="js/app-intro.js" defer></script>
`;
const introMarkup = `
  <div id="skysbridge-app-intro" aria-hidden="true">
    <video src="assets/skysbridge-intro.mp4" autoplay muted playsinline preload="auto"></video>
  </div>
`;
html = html.replace('</head>', `${introHead}</head>`);
html = html.replace(bodyOpen, `${bodyOpen}${introMarkup}`);
await writeFile(mobileIndex, html);

const entry = await stat(path.join(output, 'index.html')).catch(() => null);
if (!entry?.isFile()) throw new Error('Mobile web bundle is missing index.html');
console.log(`Prepared ${output}`);
