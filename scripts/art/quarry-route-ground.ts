/**
 * Build the Cutting / Driller floor's ground from the village's accepted plates.
 *
 *   node --import tsx scripts/art/quarry-route-ground.ts driller
 *
 * This used to tile a generated six-panel quarry material sheet by continuous
 * repeat, with three fields and three painted transitions. Three things came
 * with that sheet and none of them are wanted: a neutral cracked grey that is a
 * fourth ground family beside the village's warm limestone, no ink at any
 * region edge, and one field covering every plain cell, so about 60% of the
 * Driller's frame is a single uniform mid-brown plane and the ledges are flat
 * grey diamonds on it (design-audit defect 12).
 *
 * DL-2 W3 re-keys it the way W2 re-keyed the forest: the pixels come from
 * `quarry-village-material.ts`, which reads its structure from the two approved
 * Ba Dan plates and applies the §3 ground table. Five materials, each exactly
 * two flat tones plus a thin pale rim, the bible's uniform `#1b1410` ink on
 * every boundary between two of them, and painted incident — spoil heaps and
 * haul ruts — inside the earth plane so no quarter-frame of it is bare.
 *
 * Region routing, page origin and cell keys are untouched, so the registered
 * geometry is bit-for-bit the same and only the bytes move. Saves, collision
 * and the runtime surfaces above the page are unaffected.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { AMBUSH_ROAD, QUARRY_FLOOR } from '../../src/content/maps/combat';
import type { MapDef } from '../../src/core/types';
import { newImage, setPixel } from './lib/image';
import type { Image } from './lib/image';
import { tileNoise } from '../../src/render/painters/shapes';
import { alphaBounds, crop } from './lib/trim';
import { encodeWebp } from './lib/webp';
import { loadQuarryMaterial, QUARRY_GROUND_QUALITY } from './quarry-village-material';
import type { QuarryMaterial, QuarryTone } from './quarry-village-material';

/** One logical tile is 64x32 scene pixels; see `forest-route-ground.ts`. */
const TILE_DIAGONAL = Math.hypot(64, 32);
const INK_HALF = 1 / TILE_DIAGONAL;
const RIM_WIDTH = 3 / TILE_DIAGONAL;

export const QUARRY_PAGE = { x: -128, y: -192, width: 2304, height: 1280 } as const;
export const QUARRY_REGION_NAMES = ['dirt-west', 'dirt-east', 'road', 'stone'] as const;
export type QuarryRegionName = (typeof QUARRY_REGION_NAMES)[number];

type Kind = 'dirt' | 'road' | 'stone' | 'dynamic' | 'void';
/**
 * The ground a cell stands on, which is the material its authored page carries,
 * and therefore which page it belongs to. Unchanged from the spill pass: an oil
 * slick reads as stone and a mud patch as dirt, and water alone stays
 * transparent because its bed is authored with the liquid.
 */
const kind = (key: string | undefined): Kind =>
  key === '='
    ? 'road'
    : key === '^' || key === 'A' || key === 'r' || key === 'o'
      ? 'stone'
      : key === '~'
        ? 'dynamic'
        : key === '.' || key === ',' || key === 'c' || key === 'm'
          ? 'dirt'
          : 'void';

/**
 * Which of the five §3 materials a cell is painted in. This is a finer reading
 * than `kind`, and it is the whole point of the re-key: the ledges, the rubble
 * and the mud each become their own material instead of sharing a field with
 * the floor, which is what gives every hazard and ledge diamond an ink edge.
 */
const materialOf = (key: string | undefined): QuarryTone | null => {
  switch (key) {
    case '^':
    case 'A':
      return 'block';
    case 'r':
      return 'spoil';
    case 'o':
      return 'limestone';
    case 'm':
      return 'wear';
    case '=':
      return 'earth';
    case '.':
    case ',':
    case 'c':
      return 'earth';
    default:
      return null;
  }
};

/**
 * Where a soft join is right. §3 keeps the packer's smoothstep idiom across a
 * boundary between two walkable floor materials; a ledge face, a rubble pile
 * and a hazard pool are objects on the floor and take a crisp inked edge
 * instead, which is how the reference reads them.
 */
const plain = (key: string | undefined): boolean =>
  key === '.' || key === ',' || key === 'c' || key === '=';

const clamp = (value: number): number => Math.max(0, Math.min(1, value));

const regionOf = (x: number, key: string | undefined): QuarryRegionName | null => {
  const terrain = kind(key);
  if (terrain === 'dirt') return x < 10 ? 'dirt-west' : 'dirt-east';
  return terrain === 'road' ? 'road' : terrain === 'stone' ? 'stone' : null;
};

export function packQuarryGround(
  map: MapDef,
  material: QuarryMaterial,
): Map<QuarryRegionName, Image> {
  const images = new Map(
    QUARRY_REGION_NAMES.map((name) => [name, newImage(QUARRY_PAGE.width, QUARRY_PAGE.height)]),
  );
  for (let py = 0; py < QUARRY_PAGE.height; py++)
    for (let px = 0; px < QUARRY_PAGE.width; px++) {
      const wx = QUARRY_PAGE.x + px + 0.5,
        wy = QUARRY_PAGE.y + py + 0.5;
      const gx = ((wx - 768) / 64 + wy / 32) / 2,
        gy = (wy / 32 - (wx - 768) / 64) / 2;
      const x = Math.floor(gx),
        y = Math.floor(gy),
        key = map.rows[y]?.[x],
        name = regionOf(x, key);
      if (!name) continue;
      const own = materialOf(key);
      if (!own) continue;

      // Distance to the nearest boundary with a *different* material, and
      // whether that boundary is the region's up-screen edge — the lit one in
      // this projection, and therefore the one that carries the pale rim.
      let mix = 0;
      let swapTone: QuarryTone | null = null;
      let edge = Infinity;
      let lit = false;
      for (const [ox, oy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const neighbourKey = map.rows[y + oy]?.[x + ox];
        const other = materialOf(neighbourKey);
        if (!other || other === own) continue;
        const edgeDistance = ox < 0 ? gx - x : ox > 0 ? x + 1 - gx : oy < 0 ? gy - y : y + 1 - gy;
        if (edgeDistance < edge) {
          edge = edgeDistance;
          lit = ox < 0 || oy < 0;
        }
        if (!plain(key) || !plain(neighbourKey)) continue;
        const width = 0.16 + 0.03 * (0.5 + 0.5 * Math.sin(x * 4.1 + y * 6.7));
        // Both materials meet at the same 50/50 midpoint. The smoothstep is
        // spent on *which* of the two flat tones a pixel takes rather than on
        // blending them, so the join is soft without inventing a third key.
        const share = 0.5 * clamp((width - edgeDistance) / width);
        if (share > mix) {
          mix = share;
          swapTone = other;
        }
      }
      let tone: QuarryTone = swapTone && tileNoise(px, py, 5) < mix ? swapTone : own;

      // Painted incident, only on the plain earth plane: spoil heaps with their
      // own ink edge and chip rim, plus the haul ruts. A hazard, a ledge or a
      // dressed floor already carries its own painting.
      let inked = edge < INK_HALF;
      if (tone === 'earth' && plain(key)) {
        const heap = material.heapMark(gx, gy);
        if (heap === 'ink') inked = true;
        else if (heap === 'inside') tone = 'spoil';
        else if (heap === 'rim') tone = 'wear';
        else tone = material.trackMark(gx, gy) ?? tone;
      }

      const rgb = inked
        ? material.ink
        : lit && edge < INK_HALF + RIM_WIDTH
          ? material.rimOf(tone)
          : material.colour(tone, gx, gy);
      setPixel(images.get(name)!, px, py, [rgb[0], rgb[1], rgb[2], 255]);
    }
  return images;
}

/**
 * A clipped alpha edge filters against the procedural base during oblique
 * scaling, so extend the authored edge outward by two world pixels. Dynamic
 * (water) cells keep their hole.
 */
function bleedEdges(image: Image, map: MapDef, pixels = 2): void {
  for (let pass = 0; pass < pixels; pass++) {
    const previous = new Uint8Array(image.data);
    for (let py = 0; py < image.height; py++)
      for (let px = 0; px < image.width; px++) {
        const index = (py * image.width + px) * 4;
        if (previous[index + 3]) continue;
        const wx = QUARRY_PAGE.x + px + 0.5,
          wy = QUARRY_PAGE.y + py + 0.5;
        const gx = ((wx - 768) / 64 + wy / 32) / 2,
          gy = (wy / 32 - (wx - 768) / 64) / 2;
        if (kind(map.rows[Math.floor(gy)]?.[Math.floor(gx)]) === 'dynamic') continue;
        for (const [dx, dy] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ] as const) {
          const nx = px + dx,
            ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= image.width || ny >= image.height) continue;
          const neighbor = (ny * image.width + nx) * 4;
          if (!previous[neighbor + 3]) continue;
          image.data[index] = previous[neighbor] ?? 0;
          image.data[index + 1] = previous[neighbor + 1] ?? 0;
          image.data[index + 2] = previous[neighbor + 2] ?? 0;
          image.data[index + 3] = previous[neighbor + 3] ?? 255;
          break;
        }
      }
  }
}

/**
 * The two independently compressed dirt pages meet at logical x=10. Fade the
 * incoming east page across its existing bleed so its WebP edge cannot become
 * a visible opaque colour handoff; west remains the fully opaque underlay.
 */
function softenDirtJoin(image: Image, name: QuarryRegionName): void {
  if (name !== 'dirt-east') return;
  for (let py = 0; py < image.height; py++)
    for (let px = 0; px < image.width; px++) {
      const index = (py * image.width + px) * 4;
      const alpha = image.data[index + 3] ?? 0;
      if (!alpha) continue;
      const wx = QUARRY_PAGE.x + px + 0.5,
        wy = QUARRY_PAGE.y + py + 0.5;
      const gx = ((wx - 768) / 64 + wy / 32) / 2;
      const t = Math.max(0, Math.min(1, (gx - 9.96) / 0.08));
      const eased = t * t * (3 - 2 * t);
      image.data[index + 3] = Math.round(alpha * eased);
    }
}

export interface PackedRegion {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
}

/**
 * The finished plates, in the exact state they are encoded from: painted, bled,
 * the east dirt page's join softened, and cut to their alpha bounds. The writer
 * and the test both build them this way, which is what lets the test pin the
 * shipped bytes against the packer rather than against a recorded number.
 */
export async function buildQuarryGround(
  mapId: 'cutting' | 'driller',
): Promise<Map<QuarryRegionName, { image: Image; x: number; y: number }>> {
  const map = mapId === 'cutting' ? AMBUSH_ROAD : QUARRY_FLOOR;
  // The carts cross the open floor, so the pair straddles the board's centre.
  const images = packQuarryGround(
    map,
    await loadQuarryMaterial({ centre: map.height / 2 - 0.5, offset: 1.15 }),
  );
  const built = new Map<QuarryRegionName, { image: Image; x: number; y: number }>();
  for (const [name, image] of images) {
    bleedEdges(image, map);
    softenDirtJoin(image, name);
    const bounds = alphaBounds(image);
    if (!bounds) continue;
    built.set(name, {
      image: crop(image, bounds),
      x: QUARRY_PAGE.x + bounds.x,
      y: QUARRY_PAGE.y + bounds.y,
    });
  }
  return built;
}

export async function writeQuarryGround(
  mapId: 'cutting' | 'driller',
): Promise<{ regions: PackedRegion[]; total: number }> {
  const built = await buildQuarryGround(mapId);
  const root = mapId === 'cutting' ? 'cutting-scene' : 'driller-floor-scene';
  mkdirSync(`public/art/maps/${root}`, { recursive: true });
  const regions: PackedRegion[] = [];
  let total = 0;
  for (const [name, { image, x, y }] of built) {
    const packed = await encodeWebp(image, QUARRY_GROUND_QUALITY, true);
    writeFileSync(`public/art/maps/${root}/${name}.webp`, packed);
    total += packed.length;
    regions.push({
      name,
      x,
      y,
      width: image.width,
      height: image.height,
      bytes: packed.length,
    });
  }
  if (total > 240 * 1024) throw new Error(`${mapId} local ground exceeds 240KiB: ${total}`);
  mkdirSync(`art/raw/${root}`, { recursive: true });
  writeFileSync(
    `art/raw/${root}/route-ground-registration.json`,
    JSON.stringify(
      {
        mapId,
        source: [
          'public/art/maps/ba-dan-scene/western-approach-ground.webp',
          'public/art/maps/ba-dan-scene/courtyard-ground.webp',
        ],
        page: QUARRY_PAGE,
        regions,
        total,
      },
      null,
      2,
    ),
  );
  const exportName = mapId === 'cutting' ? 'CUTTING_GROUND_REGIONS' : 'DRILLER_GROUND_REGIONS';
  const registrationPath = 'src/content/scenes/quarryRouteGround.ts';
  const existing = existsSync(registrationPath)
    ? readFileSync(registrationPath, 'utf8')
    : '/** Generated from authoritative map rows by quarry-route-ground.ts. */\n';
  const declaration = `export const ${exportName} = ${JSON.stringify(regions, null, 2)} as const;`;
  const pattern = new RegExp(`export const ${exportName} = [\\s\\S]*? as const;`);
  writeFileSync(
    registrationPath,
    pattern.test(existing)
      ? existing.replace(pattern, declaration)
      : `${existing}\n${declaration}\n`,
  );
  return { regions, total };
}

if (process.argv[1]?.endsWith('quarry-route-ground.ts')) {
  const mapId = process.argv[2];
  if (mapId !== 'cutting' && mapId !== 'driller')
    throw new Error('Usage: quarry-route-ground.ts <cutting|driller>');
  console.log({ mapId, ...(await writeQuarryGround(mapId)) });
}
