/**
 * Fails the build if the shipped art exceeds its budget (ADR 0003).
 *
 * Two numbers: no family of art (a folder under public/art, e.g. units or
 * portraits) over 4 MB, and everything the service worker precaches (the
 * built dist, minus source maps) under 25 MB, so a first load on a tablet on
 * a family's wifi stays a breath and a Home Screen install stays small.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const FAMILY_BUDGET_MB = 4;
const PRECACHE_BUDGET_MB = 25;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir) {
  let out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(walk(full));
    else out.push(full);
  }
  return out;
}

const mb = (bytes) => (bytes / (1024 * 1024)).toFixed(2);
let failed = false;

// Raw generator output travels on the art-intake branch and is processed into
// public/art/; a checkout that carries the folder has merged that branch.
if (existsSync(join(root, 'art', 'incoming'))) {
  console.error(
    'art/incoming/ is raw intake and must never be committed: it lives on the art-intake branch only.',
  );
  process.exit(1);
}

const artDir = join(root, 'public', 'art');
const families = new Map();
for (const file of walk(artDir)) {
  const family = relative(artDir, file).split(sep)[0] ?? '.';
  families.set(family, (families.get(family) ?? 0) + statSync(file).size);
}
console.log('Art by family (budget %s MB each):', FAMILY_BUDGET_MB);
for (const [family, bytes] of [...families].sort()) {
  const over = bytes > FAMILY_BUDGET_MB * 1024 * 1024;
  if (over) failed = true;
  console.log(`  ${over ? 'OVER ' : '     '}${mb(bytes).padStart(7)} MB  ${family}`);
}
if (families.size === 0) console.log('  (no art shipped yet)');

/*
 * Sound is budgeted as one family of its own. It is not under public/art/
 * because it is not art: the art scripts, art:validate and the prompt packs
 * all walk that folder and none of them has anything to say about an ogg.
 */
const audioDir = join(root, 'public', 'audio');
let audioBytes = 0;
for (const file of walk(audioDir)) audioBytes += statSync(file).size;
const audioOver = audioBytes > FAMILY_BUDGET_MB * 1024 * 1024;
if (audioOver) failed = true;
console.log(
  'Audio (budget %s MB):\n  %s%s MB  audio',
  FAMILY_BUDGET_MB,
  audioOver ? 'OVER ' : '     ',
  mb(audioBytes).padStart(7),
);

const dist = join(root, 'dist');
const shipped = walk(dist).filter((f) => !f.endsWith('.map'));
if (shipped.length === 0) {
  console.error('dist/ not found; run `npm run build` first.');
  process.exit(1);
}
const total = shipped.reduce((sum, f) => sum + statSync(f).size, 0);
const over = total > PRECACHE_BUDGET_MB * 1024 * 1024;
if (over) failed = true;
console.log(`\nPrecache: ${mb(total)} MB of ${PRECACHE_BUDGET_MB} MB${over ? '  OVER' : ''}`);

if (failed) {
  console.error('\nAsset budget exceeded.');
  process.exit(1);
}
console.log('Asset budget OK.');
