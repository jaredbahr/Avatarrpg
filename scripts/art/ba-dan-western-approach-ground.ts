/**
 * Pack the first-view western Ba Dan approach from the accepted courtyard material.
 *
 * This is deliberately a local, transparent ground region: it covers the
 * spawn road and its immediate grass shoulders while copying the x5..6 overlap
 * directly from the accepted courtyard.
 *
 * npx tsx scripts/art/ba-dan-western-approach-ground.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import decode, { init } from '@jsquash/webp/decode.js';
import { BA_DAN_VILLAGE } from '../../src/content/maps/village';
import { newImage } from './lib/image';
import { encodeWebp } from './lib/webp';
import {
  GROUND_WEBP_QUALITY,
  pavedCell,
  villageBake,
  villageGroundRgb,
} from './ba-dan-village-material';

// The courtyard's unlit paving authority, not the shipped plate: that one now
// carries the light, and copying it here would light the road twice.
const courtyardPath = 'assets/source/ba-dan-ground-v1/courtyard-paving.webp';
const require = createRequire(import.meta.url);
const wasm = readFileSync(require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm'));
await init(await WebAssembly.compile(wasm));
const bytes = readFileSync(courtyardPath);
const courtyard = await decode(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
);

// Projected bounds for logical x0..6, y6..9. It overlaps the courtyard at
// x5..6; neither region needs a screen-space edge there because both sample
// the same material at the same logical coordinate.
const x0 = 384;
const y0 = 192;
const width = 704;
const height = 352;
const image = newImage(width, height);
const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};
const courtyardOrigin = { x: 640, y: 256 };
const colorAt = (x: number, y: number): readonly number[] => {
  const px = Math.floor(1024 + (x - y) * 64 - courtyardOrigin.x);
  const py = Math.floor((x + y) * 32 - courtyardOrigin.y);
  const at = (py * courtyard.width + px) * 4;
  return [
    courtyard.data[at] ?? 0,
    courtyard.data[at + 1] ?? 0,
    courtyard.data[at + 2] ?? 0,
    courtyard.data[at + 3] ?? 0,
  ];
};

for (let py = 0; py < height; py++) {
  for (let px = 0; px < width; px++) {
    const dx = (px + x0 - 1024 + 0.5) / 64;
    const dy = (py + y0 + 0.5) / 32;
    const x = (dx + dy) / 2;
    const y = (dy - dx) / 2;
    if (x < 0 || x >= 7 || y < 6 || y >= 10) continue;
    // Feather only toward the procedural exterior. The eastern edge sits under
    // the courtyard region, whose matching sampling already supplies the join.
    const alpha = Math.round(255 * smoothstep(0, 0.4, Math.min(x, y - 6, 10 - y)));
    if (alpha === 0) continue;
    const road = pavedCell(Math.floor(x), Math.floor(y));
    // The overlap is an exact decoded copy of the accepted courtyard. West of
    // it, repeat interior road cells x5..9,y7..8 and quiet grass x10..11,y4,
    // retaining the approved broad flagstone scale and meadow palette instead
    // of mixing in the unrelated historical raw atlas.
    const source =
      x >= 5
        ? { x, y }
        : road
          ? { x: x + 5, y }
          : {
              x: 10 + (((Math.floor(x) % 2) + 2) % 2) + (x - Math.floor(x)),
              y: 4 + (y - Math.floor(y)),
            };
    const rgba = road
      ? colorAt(source.x, source.y)
      : villageGroundRgb(px + x0 + 0.5, py + y0 + 0.5);
    const to = (py * image.width + px) * 4;
    const lit = villageBake(px + x0 + 0.5, py + y0 + 0.5, rgba);
    image.data[to] = lit[0];
    image.data[to + 1] = lit[1];
    image.data[to + 2] = lit[2];
    // Cut the new canal only after the unchanged material sample has supplied
    // RGB. Keeping the boundary correction out of the source lookup preserves
    // every dry texel (especially the quarry/forest calibration crop at
    // x1..5,y7..8). The half-source-pixel inset classifies an exact projected
    // boundary by the cell on whose centre side it falls, so row 7 stays road.
    // Trees and blocked edges still retain their grass/stone underlayers.
    const maskCell = BA_DAN_VILLAGE.rows[Math.floor(y + 1 / 128)]?.[Math.floor(x + 1 / 128)] ?? ',';
    // Courtyard alpha is a feather for its outer silhouette, never opacity
    // authority for this region's interior. Reuse its RGB, then apply only
    // the western exterior feather so overlapping road cells remain opaque.
    image.data[to + 3] = maskCell === '~' ? 0 : alpha;
  }
}

const outDir = 'public/art/maps/ba-dan-scene';
mkdirSync(outDir, { recursive: true });
// The overlap copies the decoded courtyard, so both plates carry the same
// pixels up to the encoder's noise (a couple of levels at the shared quality).
writeFileSync(
  `${outDir}/western-approach-ground.webp`,
  await encodeWebp(image, GROUND_WEBP_QUALITY, true),
);
