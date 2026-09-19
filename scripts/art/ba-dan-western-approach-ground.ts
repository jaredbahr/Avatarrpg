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

const courtyardPath = 'public/art/maps/ba-dan-scene/courtyard-ground.webp';
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
    const cell = BA_DAN_VILLAGE.rows[Math.floor(y)]?.[Math.floor(x)] ?? ',';
    // The canal remains a runtime-owned transparent surface. Trees and the
    // blocked map edge retain their grass/stone underlayers so no procedural
    // corner shows through around their transparent scenery.
    if (cell === '~') continue;
    // Feather only toward the procedural exterior. The eastern edge sits under
    // the courtyard region, whose matching sampling already supplies the join.
    const alpha = Math.round(255 * smoothstep(0, 0.4, Math.min(x, y - 6, 10 - y)));
    if (alpha === 0) continue;
    const road = cell === '=' || cell === '.' || cell === 'B' || cell === 'l';
    // The overlap is an exact decoded copy of the accepted courtyard. West of
    // it, repeat interior road cells x5..9,y7..8 and quiet grass x5..7,y9,
    // retaining the approved broad flagstone scale and meadow palette instead
    // of mixing in the unrelated historical raw atlas.
    const source =
      x >= 5
        ? { x, y }
        : road
          ? { x: x + 5, y }
          : {
              x: 5 + (((Math.floor(x) % 3) + 3) % 3) + (x - Math.floor(x)),
              y: 9 + (y - Math.floor(y)),
            };
    const rgba = colorAt(source.x, source.y);
    const to = (py * image.width + px) * 4;
    image.data[to] = rgba[0] ?? 0;
    image.data[to + 1] = rgba[1] ?? 0;
    image.data[to + 2] = rgba[2] ?? 0;
    image.data[to + 3] = Math.round(((rgba[3] ?? 255) * alpha) / 255);
  }
}

const outDir = 'public/art/maps/ba-dan-scene';
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/western-approach-ground.webp`, await encodeWebp(image, 82, true));
