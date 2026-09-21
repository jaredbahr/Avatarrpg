/** Assemble the remaining connected village courts from accepted local materials. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import decode, { init } from '@jsquash/webp/decode.js';
import { BA_DAN_VILLAGE } from '../../src/content/maps/village';
import { newImage } from './lib/image';
import { encodeWebp } from './lib/webp';

type Region = {
  readonly name: string;
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
};
// Half-open logical bounds: row 0/15 and the outer tree rim deliberately remain
// procedural. Each plate overlaps its neighbour by two or more cells so the two
// exterior feathers never leave an uncovered band between them.
const regions: readonly Region[] = [
  { name: 'northwest-lawn', x0: 0, x1: 7, y0: 3, y1: 7 },
  { name: 'north-house-court', x0: 4, x1: 18, y0: 1, y1: 5 },
  { name: 'east-gate-approach', x0: 14, x1: 24, y0: 6, y1: 10 },
  { name: 'south-house-court', x0: 5, x1: 18, y0: 10, y1: 15 },
  { name: 'northeast-lawn', x0: 15, x1: 24, y0: 1, y1: 8 },
  { name: 'southwest-lawn', x0: 0, x1: 7, y0: 9, y1: 15 },
];

const require = createRequire(import.meta.url);
const wasm = readFileSync(require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm'));
await init(await WebAssembly.compile(wasm));
async function readWebp(path: string): Promise<ImageData> {
  const bytes = readFileSync(path);
  return decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}
const courtyard = await readWebp('public/art/maps/ba-dan-scene/courtyard-ground.webp');
const western = await readWebp('public/art/maps/ba-dan-scene/western-approach-ground.webp');
const smoothstep = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const at = (
  image: ImageData,
  origin: { x: number; y: number },
  x: number,
  y: number,
): readonly number[] => {
  const px = Math.floor(1024 + (x - y) * 64 - origin.x);
  const py = Math.floor((x + y) * 32 - origin.y);
  const i = (py * image.width + px) * 4;
  return [image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0];
};
const existing = (x: number, y: number): readonly number[] | null => {
  if (x >= 5 && x < 15 && y >= 3 && y < 11) return at(courtyard, { x: 640, y: 256 }, x, y);
  if (x >= 0 && x < 7 && y >= 6 && y < 10) return at(western, { x: 384, y: 192 }, x, y);
  return null;
};
const material = (x: number, y: number, road: boolean): readonly number[] => {
  const old = existing(x, y);
  if (old) return old;
  const fx = x - Math.floor(x),
    fy = y - Math.floor(y);
  // Both sources are verified opaque interiors: quiet grass x10..11,y4 and
  // broad flagstone x5..9,y7..8. Never sample props, water, or a feather.
  return road
    ? at(
        courtyard,
        { x: 640, y: 256 },
        5 + (((Math.floor(x) % 5) + 5) % 5) + fx,
        7 + (((Math.floor(y) % 2) + 2) % 2) + fy,
      )
    : at(courtyard, { x: 640, y: 256 }, 10 + (((Math.floor(x) % 2) + 2) % 2) + fx, 4 + fy);
};

mkdirSync('public/art/maps/ba-dan-scene', { recursive: true });
for (const region of regions) {
  const x = 1024 + (region.x0 - region.y1) * 64;
  const y = (region.x0 + region.y0) * 32;
  const width = (region.x1 - region.y0 - (region.x0 - region.y1)) * 64;
  const height = (region.x1 + region.y1 - (region.x0 + region.y0)) * 32;
  const image = newImage(width, height);
  for (let py = 0; py < height; py++)
    for (let px = 0; px < width; px++) {
      const dx = (px + x - 1024 + 0.5) / 64,
        dy = (py + y + 0.5) / 32;
      const worldX = (dx + dy) / 2,
        worldY = (dy - dx) / 2;
      if (worldX < region.x0 || worldX >= region.x1 || worldY < region.y0 || worldY >= region.y1)
        continue;
      const cell = BA_DAN_VILLAGE.rows[Math.floor(worldY)]?.[Math.floor(worldX)] ?? ',';
      if (cell === '~') continue;
      const edge = Math.min(
        worldX - region.x0,
        region.x1 - worldX,
        worldY - region.y0,
        region.y1 - worldY,
      );
      const alpha = Math.round(255 * smoothstep(0, 0.4, edge));
      if (!alpha) continue;
      const rgb = material(
        worldX,
        worldY,
        cell === '=' || cell === '.' || cell === 'B' || cell === 'l',
      );
      const i = (py * width + px) * 4;
      image.data[i] = rgb[0] ?? 0;
      image.data[i + 1] = rgb[1] ?? 0;
      image.data[i + 2] = rgb[2] ?? 0;
      image.data[i + 3] = alpha;
    }
  writeFileSync(
    `public/art/maps/ba-dan-scene/${region.name}-ground.webp`,
    await encodeWebp(image, 82, true),
  );
}
