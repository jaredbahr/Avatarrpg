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
function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
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
      // Only mix across the walkable road/shoulder boundary. A pond, ledge or
      // prop stays transparent, so runtime water and independent scenery retain
      // their real footprint.
      if ((neighbour !== '=' && neighbour !== ',') || material(neighbour) === base) continue;
      const edgeDistance = ox < 0 ? x - ix : ox > 0 ? ix + 1 - x : oy < 0 ? y - iy : iy + 1 - y;
      const width = 0.16 + 0.03 * (0.5 + 0.5 * Math.sin(ix * 4.1 + iy * 6.7));
      // Both materials meet at the same 50/50 midpoint. This avoids a full
      // opposite-colour stripe on either side of the join.
      mix = Math.max(mix, 0.5 * clamp((width - edgeDistance) / width));
    }
    const other = base === 0 ? 1 : 0;
    const a = colour(base, x, y),
      b = colour(other, x, y);
    // The grass shoulders fade into the procedural field over a modest,
    // deterministic width. The central road rows stay fully opaque.
    const outerDistance = Math.min(y - 3, 10 - y);
    const featherWidth = 0.26 + 0.06 * (0.5 + 0.5 * Math.sin(x * 5.9 + y * 3.7));
    const alpha = key === ',' ? Math.round(255 * clamp(outerDistance / featherWidth)) : 255;
    setPixel(image, px, py, [
      Math.round(a[0] * (1 - mix) + b[0] * mix),
      Math.round(a[1] * (1 - mix) + b[1] * mix),
      Math.round(a[2] * (1 - mix) + b[2] * mix),
      alpha,
    ]);
  }
}
mkdirSync('public/art/maps/forest-scene', { recursive: true });
writeFileSync('public/art/maps/forest-scene/route-ground.webp', await encodeWebp(image, 86, true));
