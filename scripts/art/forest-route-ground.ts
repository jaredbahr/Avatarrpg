/**
 * Build the forest route's ground from the village's accepted paving and lawn.
 *
 *   node --import tsx scripts/art/forest-route-ground.ts
 *
 * This used to tile one quadrant of a four-quadrant forest material atlas by
 * mirrored repeat, with two materials and nothing else: the plane was one
 * swatch, and whatever light-to-dark ramp and far-edge haze lived inside that
 * swatch became a ramp and a haze on the board (design-audit defects 10 and
 * 11). DL-2 §3 asks the route to speak the village's ground language instead,
 * so the pixels now come from `forest-village-material.ts`, which re-derives
 * them from the two approved village plates the way
 * `ba-dan-neighborhood-ground.ts` re-derives the outer courts.
 *
 * Three materials, not two: the packed-earth road, the Earth-family verge, and
 * path wear along the cart ruts. Each is exactly two flat tones plus a thin
 * pale rim, so there is no continuous tone left for a gradient to hide in, and
 * every road/verge boundary carries the bible's uniform `#1b1410` ink.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { FOREST_ROAD } from '../../src/content/maps/combat';
import { newImage, setPixel } from './lib/image';
import type { Image } from './lib/image';
import { FOREST_GROUND_QUALITY, loadForestMaterial } from './forest-village-material';
import type { ForestMaterial, ToneName } from './forest-village-material';
import { tileNoise } from '../../src/render/painters/shapes';
import { encodeWebp } from './lib/webp';

export const FOREST_ROUTE_GROUND = { x: 128, y: 32, width: 1984, height: 960 } as const;
/**
 * One logical tile is 64x32 scene pixels, so a step of one tile across either
 * kind of cell edge is sqrt(64^2 + 32^2) ~= 71.6 screen pixels. The bible's
 * 2 px ink at a 64 px tile is therefore 0.014 of a tile either side, and the
 * pale rim beside it is three more pixels.
 */
const TILE_DIAGONAL = Math.hypot(64, 32);
const INK_HALF = 1 / TILE_DIAGONAL;
const RIM_WIDTH = 3 / TILE_DIAGONAL;

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
function painted(key: string | undefined): key is '=' | ',' {
  return key === '=' || key === ',';
}

export function packRouteGround(material: ForestMaterial): Image {
  const image = newImage(FOREST_ROUTE_GROUND.width, FOREST_ROUTE_GROUND.height);
  for (let py = 0; py < image.height; py++)
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
      if (!painted(key) || ix < 0 || ix >= 20 || iy < 3 || iy > 9) continue;
      const road = key === '=';

      // Distance to the nearest boundary with the *other* walkable material, and
      // whether that boundary is the region's up-screen edge, which is the lit
      // one in this projection and therefore the one that carries the rim.
      let mix = 0;
      let edge = Infinity;
      let lit = false;
      for (const [ox, oy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const neighbour = FOREST_ROAD.rows[iy + oy]?.[ix + ox];
        // Only mix across the walkable road/shoulder boundary. A pond, ledge or
        // prop stays transparent, so runtime water and independent scenery retain
        // their real footprint, and their own authored art keeps its own edge.
        if (!painted(neighbour) || (neighbour === '=') === road) continue;
        const edgeDistance = ox < 0 ? x - ix : ox > 0 ? ix + 1 - x : oy < 0 ? y - iy : iy + 1 - y;
        const width = 0.16 + 0.03 * (0.5 + 0.5 * Math.sin(ix * 4.1 + iy * 6.7));
        // Both materials meet at the same 50/50 midpoint. The smoothstep is spent
        // on *which* of the two flat tones a pixel takes rather than on blending
        // them, so the join is soft without inventing a third, intermediate key.
        mix = Math.max(mix, 0.5 * clamp((width - edgeDistance) / width));
        if (edgeDistance < edge) {
          edge = edgeDistance;
          lit = ox < 0 || oy < 0;
        }
      }

      const swapped = tileNoise(px, py, 5) < mix;
      const onRoad = swapped ? !road : road;
      const tone: ToneName = onRoad ? (material.worn(x, y) ? 'wear' : 'road') : 'verge';

      // The grass shoulders fade into the procedural field over a modest,
      // deterministic width. The central road rows stay fully opaque.
      const outerDistance = Math.min(y - 3, 10 - y);
      const featherWidth = 0.26 + 0.06 * (0.5 + 0.5 * Math.sin(x * 5.9 + y * 3.7));
      const alpha = key === ',' ? Math.round(255 * clamp(outerDistance / featherWidth)) : 255;

      const rgb =
        edge < INK_HALF
          ? material.ink
          : lit && edge < INK_HALF + RIM_WIDTH
            ? material.rimOf(tone)
            : material.colour(tone, x, y);
      setPixel(image, px, py, [rgb[0], rgb[1], rgb[2], alpha]);
    }
  return image;
}

export const FOREST_ROUTE_GROUND_OUTPUT = 'public/art/maps/forest-scene/route-ground.webp';

export async function main(): Promise<void> {
  const image = packRouteGround(await loadForestMaterial());
  mkdirSync('public/art/maps/forest-scene', { recursive: true });
  writeFileSync(FOREST_ROUTE_GROUND_OUTPUT, await encodeWebp(image, FOREST_GROUND_QUALITY, true));
}

if (process.argv[1]?.endsWith('forest-route-ground.ts')) {
  await main();
}
