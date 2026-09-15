/**
 * Fails the build if the shipped JS exceeds the budget. Keeping the bundle
 * small is the reason this game uses Canvas 2D + DOM instead of a game engine,
 * so the budget is a guard rail rather than a nice-to-have.
 */
import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BUDGET_KB = 300;
const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

let files;
try {
  files = walk(dist);
} catch {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

const js = files.filter((f) => f.endsWith('.js') && !f.endsWith('.map'));
let total = 0;
const rows = [];

for (const file of js) {
  const gz = gzipSync(readFileSync(file)).length;
  total += gz;
  rows.push([file.slice(dist.length + 1), gz]);
}

rows.sort((a, b) => b[1] - a[1]);
for (const [name, gz] of rows) {
  console.log(`  ${(gz / 1024).toFixed(1).padStart(7)} KB gz  ${name}`);
}

const totalKb = total / 1024;
console.log(`\nTotal JS: ${totalKb.toFixed(1)} KB gzipped (budget ${BUDGET_KB} KB)`);

const required = ['sw.js', 'manifest.webmanifest'];
const missing = required.filter((name) => !files.some((f) => f.endsWith(name)));
if (missing.length > 0) {
  console.error(`\nMissing PWA output: ${missing.join(', ')}`);
  process.exit(1);
}

if (totalKb > BUDGET_KB) {
  console.error(`\nOver budget by ${(totalKb - BUDGET_KB).toFixed(1)} KB.`);
  process.exit(1);
}

console.log('Bundle budget OK, PWA output present.');
