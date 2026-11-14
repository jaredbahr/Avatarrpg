/**
 * Fails the build if the shipped JS exceeds the budget. The game ships one
 * renderer (Pixi) and no game engine on top, and a tablet on a family's wifi
 * should load it in a breath, so the budget is a guard rail rather than a
 * nice-to-have. Art assets are budgeted separately (docs/roadmap.md); this
 * gate is JavaScript only.
 */
import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ADR 0104 amendment (396, owner, 2026-11-07, permanent): the top-down combat presentation (T4/T5).
// ADR 0109 (410, owner, 2026-11-12): the victory card (#630) and the guided first fight (#625).
// ADR 0104 amendment (404, owner, 2026-11-11, permanent): the rest of the demo (#500, #587, #588, #590).
// ADR 0094 had set 380 (2026-10-28); ADR 0074 had raised it to 360, ADR 0066 from 320 to 350.
// ADR 0111 §4 (accepted by the owner, 2026-11-14): since regions load on demand, 410 is what one session
// holds at most, the boot JS plus the largest region chunk, and each region chunk has its own cap.
const BUDGET_KB = 410;
const REGION_CHUNK_BUDGET_KB = 40;
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
console.log(`\nTotal JS shipped: ${totalKb.toFixed(1)} KB gzipped (reported; ADR 0111 §4)`);

/*
 * Each region's data is a chunk of its own (ADR 0111 §2), named `assets/region-<folder>-*.js`. A
 * region folder without its chunk means a shipped module imported the region's data
 * directly and the bundler pulled it back into the boot chunk.
 */
const regionRows = rows.filter(([name]) => /^assets\/region-/.test(name));
const bootKb = (total - regionRows.reduce((sum, [, gz]) => sum + gz, 0)) / 1024;
console.log(`Boot JS (everything but region chunks): ${bootKb.toFixed(1)} KB gzipped`);
for (const [name, gz] of regionRows)
  console.log(`Region chunk: ${(gz / 1024).toFixed(1)} KB gzipped  ${name}`);
const regionsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src/content/regions');
const regionFolders = readdirSync(regionsDir).filter((entry) =>
  statSync(join(regionsDir, entry)).isDirectory(),
);
const chunkless = regionFolders.filter(
  (folder) => !regionRows.some(([name]) => name.startsWith(`assets/region-${folder}-`)),
);
if (chunkless.length > 0) {
  console.error(
    `\nNo chunk for region ${chunkless.join(', ')}: its data is back in the boot chunk (ADR 0111 §2).`,
  );
  process.exit(1);
}

const required = ['sw.js', 'manifest.webmanifest'];
const missing = required.filter((name) => !files.some((f) => f.endsWith(name)));
if (missing.length > 0) {
  console.error(`\nMissing PWA output: ${missing.join(', ')}`);
  process.exit(1);
}

// The omitted Pixi functions ship as throwing stubs (ADR 0057). If a stub is
// missing, the transform in vite.config.ts stopped applying and the bytes are back.
const shipped = js.map((file) => readFileSync(file, 'utf8')).join('\n');
const stubs = ['SVGParser', 'parseSVGPath', 'measureTaggedText'].filter(
  (name) => !shipped.includes(`Pixi ${name} is omitted from this build (ADR 0057).`),
);
if (stubs.length > 0) {
  console.error(`\nMissing ADR 0057 stubs for: ${stubs.join(', ')}`);
  process.exit(1);
}

// Runtime validation goes through src/core/schema.ts (ADR 0060). zod is for CI
// and dev only; a value import of it from a shipped module brings ~10 KB back.
if (shipped.includes('ZodError')) {
  console.error(
    '\nzod is in the shipped JavaScript; import src/core/schema.ts instead (ADR 0060).',
  );
  process.exit(1);
}

const largestRegionKb = Math.max(0, ...regionRows.map(([, gz]) => gz / 1024));
const sessionKb = bootKb + largestRegionKb;
console.log(
  `Boot plus the largest region: ${sessionKb.toFixed(1)} KB gzipped (budget ${BUDGET_KB} KB); each region chunk budget ${REGION_CHUNK_BUDGET_KB} KB`,
);
const fatRegions = regionRows.filter(([, gz]) => gz / 1024 > REGION_CHUNK_BUDGET_KB);
if (fatRegions.length > 0) {
  console.error(
    `\nRegion chunk over ${REGION_CHUNK_BUDGET_KB} KB: ${fatRegions.map(([name]) => name).join(', ')}`,
  );
  process.exit(1);
}
if (sessionKb > BUDGET_KB) {
  console.error(`\nOver budget by ${(sessionKb - BUDGET_KB).toFixed(1)} KB.`);
  process.exit(1);
}

console.log('Bundle budget OK, PWA output present.');
