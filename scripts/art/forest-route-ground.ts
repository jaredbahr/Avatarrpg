/** Build one local, transparent forest route region from the reviewed material atlas. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { FOREST_ROAD } from '../../src/content/maps/combat';
import { newImage, pixelAt, readImage, setPixel } from './lib/image';
import { encodeWebp } from './lib/webp';

const source = process.argv[2];
if (!source) throw new Error('Provide the reviewed four-quadrant forest material atlas.');
const atlas = readImage(source);
const swatch = Math.floor(Math.min(atlas.width, atlas.height) / 2);
const edge = 3;
const period = swatch - edge * 2;
const image = newImage(1984, 960);
export const FOREST_ROUTE_GROUND = { x: 128, y: 32, width: 1984, height: 960 } as const;

function sample(value: number): number {
  const wrapped = ((value % (period * 2)) + period * 2) % (period * 2);
  return edge + Math.min(period - 1, Math.floor(wrapped < period ? wrapped : period * 2 - wrapped));
}
function material(key: string): number {
  return key === '=' ? 0 : 1;
}
function colour(kind: number, x: number, y: number) {
  const sx = sample(x * 192) + (kind % 2) * swatch;
  const sy = sample(y * 192) + Math.floor(kind / 2) * swatch;
  return pixelAt(atlas, sx, sy);
}

for (let py = 0; py < image.height; py++) {
  for (let px = 0; px < image.width; px++) {
    const worldX = FOREST_ROUTE_GROUND.x + px + 0.5;
    const worldY = FOREST_ROUTE_GROUND.y + py + 0.5;
    const dx = (worldX - 768) / 64;
    const dy = worldY / 32;
    const x = (dx + dy) / 2;
    const y = (dy - dx) / 2;
    const ix = Math.floor(x),
      iy = Math.floor(y);
    const key = FOREST_ROAD.rows[iy]?.[ix];
    // The local route has only road and its grass shoulders. Water, ledges and
    // cover remain transparent so the real grid and runtime materials show.
    if ((key !== '=' && key !== ',') || ix < 0 || ix >= 20 || iy < 3 || iy > 9) continue;
    const base = material(key);
    let mix = 0;
    for (const [ox, oy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const neighbour = FOREST_ROAD.rows[iy + oy]?.[ix + ox];
      if (!neighbour || material(neighbour) === base) continue;
      const edgeDistance = ox < 0 ? x - ix : ox > 0 ? ix + 1 - x : oy < 0 ? y - iy : iy + 1 - y;
      mix = Math.max(mix, Math.max(0, Math.min(1, (0.2 - edgeDistance) / 0.2)));
    }
    const other = base === 0 ? 1 : 0;
    const a = colour(base, x, y),
      b = colour(other, x, y);
    setPixel(image, px, py, [
      Math.round(a[0] * (1 - mix) + b[0] * mix),
      Math.round(a[1] * (1 - mix) + b[1] * mix),
      Math.round(a[2] * (1 - mix) + b[2] * mix),
      255,
    ]);
  }
}
mkdirSync('public/art/maps/forest-scene', { recursive: true });
writeFileSync('public/art/maps/forest-scene/route-ground.webp', await encodeWebp(image, 86, true));
