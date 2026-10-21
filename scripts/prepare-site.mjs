import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'site-dist');
const excludedDirectories = new Set([
  '.git', '.github', '.netlify', 'android', 'ios', 'mobile', 'netlify',
  'node_modules', 'scripts', 'site-dist', 'supabase', 'www'
]);
const excludedFiles = new Set([
  'capacitor.config.json', 'package.json', 'package-lock.json', 'netlify.toml'
]);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

async function copyWebsiteFiles(source, destination) {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const name = entry.name;
    if (name.startsWith('.') || excludedDirectories.has(name) || excludedFiles.has(name)) continue;
    const from = path.join(source, name);
    const to = path.join(destination, name);
    if (entry.isDirectory()) await copyWebsiteFiles(from, to);
    else await cp(from, to);
  }
}

await copyWebsiteFiles(root, output);
for (const required of ['index.html', 'index-de.html', 'index-es.html', '_headers']) {
  const present = await readdir(output);
  if (!present.includes(required)) throw new Error(`Website build is missing ${required}`);
}
console.log(`Prepared website output ${output} without the app-only animation.`);
