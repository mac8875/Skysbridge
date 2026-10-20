import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'www');
const wordmark = await sharp(path.join(root, 'skys-bridge-wordmark.svg'))
  .resize({ width: 940 })
  .png()
  .toBuffer();
await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: '#04121f' }
})
  .composite([{ input: wordmark, left: 42, top: 394 }])
  .png()
  .toFile(path.join(root, 'assets/icon-only.png'));
const excludedDirectories = new Set([
  '.git', '.github', '.netlify', 'android', 'ios', 'node_modules', 'supabase', 'www'
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

const entry = await stat(path.join(output, 'index.html')).catch(() => null);
if (!entry?.isFile()) throw new Error('Mobile web bundle is missing index.html');
console.log(`Prepared ${output}`);
