/**
 * Fails the build if the shipped art exceeds its budget (ADR 0003).
 *
 * Two numbers: no family of art (a folder under public/art, e.g. units or
 * portraits) over 4 MB (units and maps have a larger number of their own, below), and everything the service worker precaches (the
 * built dist, minus source maps and what `precache.mjs` leaves for run time) under 25 MB, so a first load on a tablet on
 * a family's wifi stays a breath and a Home Screen install stays small.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPrecacheIgnored } from './precache.mjs';
// TypeScript, so `check:assets` runs this script under tsx: the region manifests are the source.
import { regionAssets } from './region-assets.ts';

const FAMILY_BUDGET_MB = 4;
// ADR 0051: the PixelLab G party's locomotion now, and its stance and bend
// sets to come (ADR 0035 had added the fire deserter at 4.75). ADR 0082: the
// owner raised it to 8.5 for Ba Dan's residents (20 October 2026).
const UNIT_BUDGET_MB = 8.5;
// ADR 0075: Ba Dan's pieces are painted at 1.5x the world scale for crispness; the village is the proof the
// polish can be done. ADR 0076: it is one continuous painting now (12 plates and 2 sprite pages, 4.1 MB), the
// family measures 7.34 MiB, and the owner allowed the raise (9 October 2026) to the next half MiB. ADR 0088: Ba Dan and the
// forest's uprights ship at 1 px per world px (27 October 2026), the family measures 5.48 MiB, and the budget comes down to
// the next half MiB over it, so the freed space goes to the precache total rather than to this family.
const MAPS_BUDGET_MB = 6;
// ADR 0104 amendment (owner, 2026-11-07, permanent): the top-down port's sheets, boards, objects and effects.
const TOPDOWN_BUDGET_MB = 6;
/** A family's budget; any family not named here has `FAMILY_BUDGET_MB`. */
const FAMILY_BUDGETS_MB = new Map([
  ['units', UNIT_BUDGET_MB],
  ['maps', MAPS_BUDGET_MB],
  ['topdown', TOPDOWN_BUDGET_MB],
]);
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
console.log(
  'Art by family (budget %s MiB; units %s MiB; maps %s MiB):',
  FAMILY_BUDGET_MB,
  UNIT_BUDGET_MB,
  MAPS_BUDGET_MB,
);
for (const [family, bytes] of [...families].sort()) {
  const budget = FAMILY_BUDGETS_MB.get(family) ?? FAMILY_BUDGET_MB;
  const over = bytes > budget * 1024 * 1024;
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

/*
 * Per region (ADR 0111 §4), reported only: each region's boards and area music, the shared music
 * and the sound effects. The gates above and below are unchanged until the owner agrees new ones.
 */
const bytesUnder = (path) => {
  const full = join(root, 'public', path);
  if (!existsSync(full)) return 0;
  if (!statSync(full).isDirectory()) return statSync(full).size;
  return walk(full).reduce((sum, f) => sum + statSync(f).size, 0);
};
const plan = regionAssets();
console.log('\nBy region (reported, not gated):');
for (const region of plan.regions) {
  const art = region.artDirs.reduce((sum, dir) => sum + bytesUnder(dir), 0);
  const music = region.musicFiles.reduce((sum, file) => sum + bytesUnder(file), 0);
  console.log(`  ${mb(art).padStart(7)} MB  ${region.id} boards (${region.artDirs.length} maps)`);
  console.log(
    `  ${mb(music).padStart(7)} MB  ${region.id} music (${region.musicFiles.length} tracks)`,
  );
}
const sharedMusic = plan.sharedMusic.reduce((sum, file) => sum + bytesUnder(file), 0);
const effects = walk(audioDir)
  .filter((f) => !relative(audioDir, f).split(sep).includes('music'))
  .reduce((sum, f) => sum + statSync(f).size, 0);
console.log(
  `  ${mb(sharedMusic).padStart(7)} MB  shared music (${plan.sharedMusic.length} tracks)`,
);
console.log(`  ${mb(effects).padStart(7)} MB  sound effects`);

const dist = join(root, 'dist');
const shipped = walk(dist).filter((f) => !f.endsWith('.map'));
if (shipped.length === 0) {
  console.error('dist/ not found; run `npm run build` first.');
  process.exit(1);
}
// What the service worker leaves for run time (`precache.mjs`) is shipped but not precached; its
// family budget still holds above.
const precached = shipped.filter((f) => !isPrecacheIgnored(relative(dist, f).split(sep).join('/')));
const deferred = shipped.length - precached.length;
const total = precached.reduce((sum, f) => sum + statSync(f).size, 0);
const over = total > PRECACHE_BUDGET_MB * 1024 * 1024;
if (over) failed = true;
console.log(
  `\nPrecache: ${mb(total)} MB of ${PRECACHE_BUDGET_MB} MB${over ? '  OVER' : ''} (${deferred} files fetched at run time, not precached)`,
);

if (failed) {
  console.error('\nAsset budget exceeded.');
  process.exit(1);
}
console.log('Asset budget OK.');
