/*
 * Compare two heads' `route-tone` frames pixel for pixel.
 *
 * The blast radius of a palette lift is the set of pixels that move between the
 * heads on an identical fixture. This reads that set per board and per layer
 * (authored board, procedural only, bare cells), says how far it moved and
 * which way, and draws where it is on a 48 px grid. Capture the frames with
 * `playwright.route-tone.config.ts` first: see `e2e/route-tone.review.ts`.
 *
 *   node scripts/route-tone-compare.mjs .shots/route-tone/before \
 *     .shots/route-tone/after
 */
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const [beforeDir, afterDir] = process.argv.slice(2);
const NODES = (process.env.FNT_RT_NODES ?? 'battle_forest_road,battle_ambush').split(',');
const RENDERERS = (process.env.FNT_RT_RENDERERS ?? 'canvas,webgl').split(',');
const LAYERS = ['authored', 'procedural', 'cells'];
// Channel-sum threshold, the same 24 the tone probes classify seams with.
const THRESHOLD = 24;

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const at = (img, i) => lum(img.data[i], img.data[i + 1], img.data[i + 2]);

for (const renderer of RENDERERS) {
  for (const node of NODES) {
    for (const layer of LAYERS) {
      const file = `${node}-${renderer}-${layer}.png`;
      let a;
      let b;
      try {
        a = PNG.sync.read(readFileSync(`${beforeDir}/${file}`));
        b = PNG.sync.read(readFileSync(`${afterDir}/${file}`));
      } catch {
        console.log(`${renderer} ${node} ${layer}: no frame pair, skipped`);
        continue;
      }
      if (a.width !== b.width || a.height !== b.height) {
        console.log(
          `${renderer} ${node} ${layer}: ${a.width}x${a.height} vs ${b.width}x${b.height}`,
        );
        continue;
      }
      let changed = 0;
      let up = 0;
      let down = 0;
      let beforeLum = 0;
      let afterLum = 0;
      const lines = [];
      for (let y = 0; y < b.height; y++) {
        let line = '';
        for (let x = 0; x < b.width; x++) {
          const i = (y * b.width + x) * 4;
          const delta =
            Math.abs(a.data[i] - b.data[i]) +
            Math.abs(a.data[i + 1] - b.data[i + 1]) +
            Math.abs(a.data[i + 2] - b.data[i + 2]);
          const moved = delta > THRESHOLD;
          if (moved) {
            changed++;
            beforeLum += at(a, i);
            afterLum += at(b, i);
            if (at(b, i) > at(a, i)) up++;
            else down++;
          }
          if (x % 48 === 24 && y % 48 === 24)
            line += moved ? (at(b, i) > at(a, i) ? '+' : '-') : '.';
        }
        if (line) lines.push(`  ${line}`);
      }
      const total = b.width * b.height;
      console.log(
        `${renderer} ${node} ${layer}: ${changed} of ${total} px moved ` +
          `(${((changed / total) * 100).toFixed(2)}%), brighter ${up} / darker ${down}, ` +
          `mean luminance ${changed ? (beforeLum / changed).toFixed(1) : '-'} -> ` +
          `${changed ? (afterLum / changed).toFixed(1) : '-'}`,
      );
      if (changed > 0 && lines.length > 0) console.log(lines.join('\n'));
    }
  }
}
