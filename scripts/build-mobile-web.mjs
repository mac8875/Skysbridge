import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'www');
const excluded = new Set([
  '.git', 'node_modules', 'android', 'ios', 'www', 'scripts', 'mobile',
  'package.json', 'package-lock.json', 'capacitor.config.ts', 'capacitor.config.json',
]);
const publicFiles = new Set([
  '.html', '.css', '.js', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico',
  '.woff', '.woff2', '.ttf', '.xml', '.txt',
]);

async function copyPublic(source, destination) {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyPublic(from, to);
    } else if (entry.isFile() && publicFiles.has(path.extname(entry.name).toLowerCase())) {
      await cp(from, to);
    }
  }
}

await rm(out, { recursive: true, force: true });
await copyPublic(root, out);
await build({
  entryPoints: [path.join(root, 'mobile/native-runtime.js')],
  outfile: path.join(out, 'mobile-runtime.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
});
await build({
  entryPoints: [path.join(root, 'mobile/supabase-runtime.js')],
  outfile: path.join(out, 'supabase-runtime.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
});

const htmlFiles = (await readdir(out)).filter(file => file.endsWith('.html'));
const scriptPattern = /<script\b[^>]*\bsrc=["'](?:js\/(?:app(?:-[^"']*)?|language-switch|wall-of-stars-v2)\.js)[^"']*["'][^>]*>/i;
for (const file of htmlFiles) {
  const htmlPath = path.join(out, file);
  const html = await readFile(htmlPath, 'utf8');
  if (html.includes('mobile-runtime.js')) continue;
  const script = '<script src="mobile-runtime.js"></script>\n  ';
  const withLocalSupabase = html.replace(
    /https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2/g,
    'supabase-runtime.js',
  );
  const updated = scriptPattern.test(withLocalSupabase)
    ? withLocalSupabase.replace(scriptPattern, match => `${script}${match}`)
    : withLocalSupabase.replace(/<\/body>/i, `${script}</body>`);
  await writeFile(htmlPath, updated);
}

console.log(`Prepared ${htmlFiles.length} Skysbridge pages in www/`);
