/**
 * Build the Cutting / Driller floor's ground from the village's accepted plates.
 *
 *   node --import tsx scripts/art/quarry-route-ground.ts driller
 *   node --import tsx scripts/art/quarry-route-ground.ts cutting
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
 * DL-2 W4 folds The Cutting in through the same table. The Cutting is the
 * gate's road layout cut between ledges, so it takes the gate's reading of that
 * layout (`quarry-modular-ground.ts`): a packed-earth cart lane with one haul
 * track per lane, spoil shoulders carrying whole inked heaps of cut stone, and
 * cut-stone ledges.
 *
 * DL-2 W5 gate fixes. The gate found the Cutting and the floor reading
 * backwards: the decorative heaps, inked and in limestone, were the loudest
 * thing on the board while real cover (legend `r`) was a faint inked diamond.
 * Now the decorative heaps are small uninked mounds in the spoil row
 * (`heapClass`), every `r` cell carries the route's painted heap
 * (`forest-rubble.ts`'s plate, registered in `quarryProjected.ts`) standing on
 * its spill, and the pages paint the ground under it rather than a diamond. The
 * two dirt pages overlap by two cells across `x = 10` (`DIRT_OVERLAP`), and the
 * Cutting's pool gets the forest pond's bed and bank (`buildCuttingPool`).
 *
 * Page origin and cell keys are untouched. Saves, collision and the runtime
 * surfaces above the page are unaffected.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { AMBUSH_ROAD, QUARRY_FLOOR } from '../../src/content/maps/combat';
import { CUTTING_POOL_PATCH, CUTTING_WATER_CELLS } from '../../src/content/scenes/quarryProjected';
import type { MapDef, Vec2 } from '../../src/core/types';
import { newImage, setPixel } from './lib/image';
import type { Image } from './lib/image';
import { tileNoise } from '../../src/render/painters/shapes';
import { alphaBounds, crop } from './lib/trim';
import { encodeWebp } from './lib/webp';
import { spillDepth, spillWins } from './forest-rubble';
import { packShoreline } from './forest-shoreline';
import { heapFits, loadQuarryMaterial, QUARRY_GROUND_QUALITY } from './quarry-village-material';
import type { QuarryMaterial, QuarryTone, Rgb } from './quarry-village-material';

/** One logical tile is 64x32 scene pixels; see `forest-route-ground.ts`. */
const TILE_DIAGONAL = Math.hypot(64, 32);
const INK_HALF = 1 / TILE_DIAGONAL;
const RIM_WIDTH = 3 / TILE_DIAGONAL;

export const QUARRY_PAGE = { x: -128, y: -192, width: 2304, height: 1280 } as const;
export const QUARRY_REGION_NAMES = ['dirt-west', 'dirt-east', 'road', 'stone'] as const;
export type QuarryRegionName = (typeof QUARRY_REGION_NAMES)[number];

/**
 * The two dirt pages are compressed independently and used to meet on the line
 * `x = 10`, where the east page faded in over 0.08 of a tile. Anywhere their
 * two edges did not agree to the pixel the procedural terrain showed through —
 * and in the Cutting that terrain is grass, so the join read as a green seam
 * (DL-2 W5 gate). Now both pages paint the columns either side of the line, so
 * they overlap by `DIRT_OVERLAP` whole cells of identical painting, and the
 * east page fades in across the middle of that overlap (`DIRT_FADE`), over
 * ground the west page already covers opaquely.
 */
export const DIRT_SPLIT = 10;
export const DIRT_OVERLAP = 2;
export const DIRT_FADE = { from: DIRT_SPLIT - 0.75, to: DIRT_SPLIT + 0.75 } as const;

type Kind = 'dirt' | 'road' | 'stone' | 'water' | 'void';
/**
 * The ground a cell stands on, which is the material its authored page carries,
 * and therefore which page it belongs to. An oil slick reads as stone and a
 * mud patch as dirt. A rubble cell reads as the floor its heap stands on
 * (`groundKey`). Water alone stays a hole in every page: its bed and bank are
 * the pool's own plate (`buildCuttingPool`), as the forest pond's are.
 */
const kind = (key: string | undefined): Kind =>
  key === '='
    ? 'road'
    : key === '^' || key === 'A' || key === 'o'
      ? 'stone'
      : key === '~'
        ? 'water'
        : key === '.' || key === ',' || key === 'c' || key === 'm'
          ? 'dirt'
          : 'void';

/**
 * Which of the §3 materials a cell is painted in. This is a finer reading than
 * `kind`: the ledges and the hazards each become their own material instead of
 * sharing a field with the floor, which is what gives every ledge and oil
 * diamond an ink edge.
 */
const materialOf = (key: string | undefined): QuarryTone | null => {
  switch (key) {
    case '^':
    case 'A':
      return 'block';
    case 'o':
      return 'limestone';
    case 'm':
      return 'wear';
    case '=':
      return 'earth';
    // The Cutting's shoulders. The Cutting is the gate's road layout — a
    // cart lane with loose ground either side — cut between ledges, so it
    // takes the gate's reading of that layout: packed-earth lane, spoil
    // shoulders. As earth they would merge with the lane into one plane and
    // the approved road would vanish. The Driller floor has no `,` cell.
    case ',':
      return 'spoil';
    case '.':
    case 'c':
      return 'earth';
    default:
      return null;
  }
};

/**
 * Where a soft join is right. §3 keeps the packer's smoothstep idiom across a
 * boundary between two walkable floor materials; a ledge face and a hazard
 * pool are objects on the floor and take a crisp inked edge instead, which is
 * how the reference reads them.
 */
const plain = (key: string | undefined): boolean =>
  key === '.' || key === ',' || key === 'c' || key === '=';

/**
 * The ground under a cell, as the pages paint it. A rubble cell (legend `r`) is
 * no longer painted as a diamond of its own: its heap is the route's painted
 * heap plate, drawn over the page (`quarryProjected.ts`), and the page lays the
 * floor it stands on — the Cutting's spoil shoulder, or the Driller's packed
 * earth with the heap's spill shed across it. An inked spoil diamond was all
 * that marked cover before, and it read as a faint tile beside the decorative
 * heaps (DL-2 W5 gate).
 */
function groundKey(map: MapDef, x: number, y: number): string | undefined {
  const key = map.rows[y]?.[x];
  if (key !== 'r') return key;
  const around = [
    map.rows[y]?.[x - 1],
    map.rows[y]?.[x + 1],
    map.rows[y - 1]?.[x],
    map.rows[y + 1]?.[x],
  ];
  return around.includes(',') ? ',' : '.';
}

/** Every cell of a map carrying one legend key. */
export function cellsOf(map: MapDef, key: string): Vec2[] {
  return map.rows.flatMap((row, y) =>
    [...row].flatMap((value, x) => (value === key ? [{ x, y }] : [])),
  );
}

const clamp = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * Open floor a decorative heap may lie on: plain ground of one material, a
 * whole cell clear of every cover cell and its spill, so no decorative mound
 * sits beside a real heap to be read as part of it. A heap reaching a lane
 * edge, a ledge or a hazard is dropped whole by `heapFits`.
 */
export const openFloor =
  (map: MapDef, material: QuarryTone) =>
  (x: number, y: number): boolean => {
    const key = map.rows[y]?.[x];
    if (materialOf(key) !== material || !plain(key)) return false;
    for (let oy = -1; oy <= 1; oy++)
      for (let ox = -1; ox <= 1; ox++) if (map.rows[y + oy]?.[x + ox] === 'r') return false;
    return true;
  };

/**
 * The pages a cell is painted on. The two dirt pages overlap by
 * `DIRT_OVERLAP` columns across `DIRT_SPLIT`.
 */
function pagesOf(x: number, terrain: Kind): QuarryRegionName[] {
  if (terrain === 'dirt') {
    const pages: QuarryRegionName[] = [];
    if (x < DIRT_SPLIT + DIRT_OVERLAP / 2) pages.push('dirt-west');
    if (x >= DIRT_SPLIT - DIRT_OVERLAP / 2) pages.push('dirt-east');
    return pages;
  }
  if (terrain === 'road') return ['road'];
  return terrain === 'stone' ? ['stone'] : [];
}

/** Logical point of a page pixel's centre. */
function cellAt(px: number, py: number): { gx: number; gy: number; x: number; y: number } {
  const wx = QUARRY_PAGE.x + px + 0.5,
    wy = QUARRY_PAGE.y + py + 0.5;
  const gx = ((wx - 768) / 64 + wy / 32) / 2,
    gy = (wy / 32 - (wx - 768) / 64) / 2;
  return { gx, gy, x: Math.floor(gx), y: Math.floor(gy) };
}

export function packQuarryGround(
  map: MapDef,
  material: QuarryMaterial,
): Map<QuarryRegionName, Image> {
  const images = new Map(
    QUARRY_REGION_NAMES.map((name) => [name, newImage(QUARRY_PAGE.width, QUARRY_PAGE.height)]),
  );
  const rubble = cellsOf(map, 'r');
  const spoilFloor = openFloor(map, 'spoil');
  const earthFloor = openFloor(map, 'earth');

  for (let py = 0; py < QUARRY_PAGE.height; py++)
    for (let px = 0; px < QUARRY_PAGE.width; px++) {
      const { gx, gy, x, y } = cellAt(px, py);
      const key = groundKey(map, x, y);
      const terrain = kind(key);
      const pages = pagesOf(x, terrain);
      if (!pages.length) continue;
      const paint = (rgb: Rgb): void => {
        for (const name of pages)
          setPixel(images.get(name)!, px, py, [rgb[0], rgb[1], rgb[2], 255]);
      };

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
        const neighbourKey = groundKey(map, x + ox, y + oy);
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

      // Painted incident, only on plain floor. A ledge or a hazard already
      // carries its own painting.
      let heap: Rgb | null = null;
      if (tone === 'earth' && plain(key) && (key === '=' || own !== 'earth')) {
        // A cart lane, or its feathered fringe: haul tracks only, as at the
        // gate. Spoil heaps do not sit in a cart lane.
        tone = material.trackMark(gx, gy) ?? tone;
      } else if (tone === 'earth' && plain(key)) {
        // The Driller's packed-earth floor. Round each cover cell its heap's
        // spill of spoil breaks up into the floor the way the forest's breaks
        // into the verge (`spillWins`); elsewhere, low uninked spoil mounds
        // and the haul ruts.
        const spilt =
          rubble.length > 0 &&
          spillWins(
            spillDepth(gx, gy, rubble),
            gx,
            gy,
            () => material.classOf('earth', gx, gy) !== 'base',
          );
        if (spilt) tone = 'spoil';
        else {
          heap = heapFits(gx, gy, earthFloor) ? material.heapMark(gx, gy) : null;
          if (!heap) tone = material.trackMark(gx, gy) ?? tone;
        }
      } else if (tone === 'spoil' && own === 'spoil' && plain(key)) {
        const spilt =
          rubble.length > 0 &&
          spillWins(
            spillDepth(gx, gy, rubble),
            gx,
            gy,
            () => material.classOf('spoil', gx, gy) === 'rim',
          );
        // The Cutting's shoulders are spoil already, so a heap's spill laid in
        // the shoulder's own key would not show. It is the fresh grit round
        // the heap's foot, so it takes the spoil row the other way up
        // (`spillMark`): a darker footprint about the cell's size, broken up
        // at its edge, that grounds the heap on the shoulder. Elsewhere on the
        // shoulders, the same low mounds as the floor, in the spoil row alone,
        // so they read as the shoulder's texture and not as cover.
        if (spilt) heap = material.spillMark(gx, gy);
        else if (heapFits(gx, gy, spoilFloor)) heap = material.heapMark(gx, gy);
      }

      paint(
        edge < INK_HALF
          ? material.ink
          : lit && edge < INK_HALF + RIM_WIDTH
            ? material.rimOf(tone)
            : (heap ?? material.colour(tone, gx, gy)),
      );
    }
  return images;
}

/**
 * A clipped alpha edge filters against the procedural base during oblique
 * scaling, so extend the authored edge outward by two world pixels. Water
 * cells keep their hole; the pool's own plate covers them.
 */
function bleedEdges(image: Image, map: MapDef, pixels = 2): void {
  for (let pass = 0; pass < pixels; pass++) {
    const previous = new Uint8Array(image.data);
    for (let py = 0; py < image.height; py++)
      for (let px = 0; px < image.width; px++) {
        const index = (py * image.width + px) * 4;
        if (previous[index + 3]) continue;
        const { x, y } = cellAt(px, py);
        if (kind(map.rows[y]?.[x]) === 'water') continue;
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
 * The east dirt page fades in across the middle of the two pages' overlap
 * (`DIRT_FADE`). Both pages carry the same painting there and the west page is
 * opaque under all of it, so the fade hides only the two encoders'
 * disagreement, never the ground.
 */
function softenDirtJoin(image: Image, name: QuarryRegionName): void {
  if (name !== 'dirt-east') return;
  for (let py = 0; py < image.height; py++)
    for (let px = 0; px < image.width; px++) {
      const index = (py * image.width + px) * 4;
      const alpha = image.data[index + 3] ?? 0;
      if (!alpha) continue;
      const t = clamp((cellAt(px, py).gx - DIRT_FADE.from) / (DIRT_FADE.to - DIRT_FADE.from));
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

const CUTTING_TRACK = { centre: 6, offset: 1.5 } as const;

/**
 * The Cutting's pool: its bed, the bank biting into it, the inked wet line and
 * the damp margin round it, packed by the forest pond's own packer
 * (`packShoreline`) in the same §3 keys, so the route has one water language
 * instead of a flat teal rectangle beside the forest's banked pond. It is its
 * own plate drawn over the pages, exactly as the forest's `pond-bank.webp` is,
 * and the live 0.4-alpha film still covers every water cell and tints its bed.
 */
export const CUTTING_POOL_OUTPUT = 'public/art/maps/cutting-scene/pool-bank.webp';
export async function buildCuttingPool(): Promise<Image> {
  const material = await loadQuarryMaterial(CUTTING_TRACK);
  return packShoreline(material, { patch: CUTTING_POOL_PATCH, cells: CUTTING_WATER_CELLS }).image;
}

/** Rewrite one generated declaration in the registration file, or append it. */
function register(declaration: string, pattern: RegExp): void {
  const registrationPath = 'src/content/scenes/quarryRouteGround.ts';
  const existing = existsSync(registrationPath)
    ? readFileSync(registrationPath, 'utf8')
    : '/** Generated from authoritative map rows by quarry-route-ground.ts. */\n';
  writeFileSync(
    registrationPath,
    pattern.test(existing)
      ? existing.replace(pattern, declaration)
      : `${existing}\n${declaration}\n`,
  );
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
  // On the Driller the carts cross the open floor, so the pair straddles the
  // board's centre. The Cutting's road splits round the pool into two one-row
  // lanes, rows 4 and 7, so it runs one track down the middle of each.
  const track = mapId === 'cutting' ? CUTTING_TRACK : { centre: 5.5, offset: 1.15 };
  const images = packQuarryGround(map, await loadQuarryMaterial(track));
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
  register(
    `export const ${exportName} = ${JSON.stringify(regions, null, 2)} as const;`,
    new RegExp(`export const ${exportName} = [\\s\\S]*? as const;`),
  );
  if (mapId === 'cutting') {
    const pool = await encodeWebp(await buildCuttingPool(), QUARRY_GROUND_QUALITY, true);
    writeFileSync(CUTTING_POOL_OUTPUT, pool);
    total += pool.length;
    // A pin, like each page's `bytes`: the test holds the file on disk to it.
    register(
      `export const CUTTING_POOL_BYTES = ${pool.length};`,
      /export const CUTTING_POOL_BYTES = \d+;/,
    );
  }
  return { regions, total };
}

if (process.argv[1]?.endsWith('quarry-route-ground.ts')) {
  const mapId = process.argv[2];
  if (mapId !== 'cutting' && mapId !== 'driller')
    throw new Error('Usage: quarry-route-ground.ts <cutting|driller>');
  console.log({ mapId, ...(await writeQuarryGround(mapId)) });
}
