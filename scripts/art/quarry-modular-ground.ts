/**
 * Build the quarry gate's local ground from the village's accepted plates.
 *
 *   node --import tsx scripts/art/quarry-modular-ground.ts
 *
 * This used to tile the same generated six-panel quarry sheet the Driller floor
 * did, with three fields and three painted transitions and no ink anywhere, and
 * it is the reason the gate reads as a fourth ground family beside Ba Dan
 * (design-audit defect 32). DL-2 W3 re-keys it from
 * `quarry-village-material.ts`, exactly as the Driller floor is re-keyed, so
 * the two quarry scenes cannot drift from each other or from the village.
 *
 * Three materials across the four registered regions, which is what the gate's
 * geometry is actually describing:
 *
 * - `limestone` region → the §3 limestone paving of the gatehouse terrace,
 *   and the cut quarry rock (`X`) in the corners: the Cutting's `block` key,
 *   stood `ROCK_RISE` above the terrace on a two-course block face so it
 *   reads as the rock it is, never as open floor.
 * - `road` region → §3 packed earth, with the haul tracks running down its two
 *   rows in the cart-rut tone.
 * - `earth-west` / `earth-east` → §3 quarry spoil, the loose ground either side
 *   of the road, carrying small low mounds of spoil as texture. Since the DL-2
 *   W5 gate they carry no ink and no limestone: the gate has no cover cell (its
 *   cover is Pella's timber), and inked heaps read as cover that was not there.
 *   A mound is painted only if it fits wholly on open terrace, the rule The
 *   Cutting uses (`heapFits`), so none is cut by the road's edge or a ledge.
 *
 * Region routing, page origin and cell keys are untouched, so the registered
 * geometry is unchanged and only the bytes move.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { QUARRY_GATE } from '../../src/content/maps/combat';
import { newImage, parseHex, setPixel } from './lib/image';
import type { Image } from './lib/image';
import { tileNoise } from '../../src/render/painters/shapes';
import { alphaBounds, crop } from './lib/trim';
import { encodeWebp } from './lib/webp';
import {
  heapFits,
  loadQuarryMaterial,
  QUARRY_GROUND_QUALITY,
  QUARRY_GROUND_TONES,
} from './quarry-village-material';
import type { QuarryMaterial, QuarryTone, Rgb } from './quarry-village-material';

const TILE_DIAGONAL = Math.hypot(64, 32);
const INK_HALF = 1 / TILE_DIAGONAL;
const RIM_WIDTH = 3 / TILE_DIAGONAL;

export const QUARRY_GATE_PAGE = { x: -128, y: -192, width: 2304, height: 1280 } as const;
export const QUARRY_GATE_REGION_NAMES = ['earth-west', 'earth-east', 'road', 'limestone'] as const;
export type GateRegionName = (typeof QUARRY_GATE_REGION_NAMES)[number];

/**
 * How far the cut rock (`X`) stands above the terrace, in world pixels: two
 * courses of `COURSE`, one per tier of its elevation, so it reads a full step
 * above the tier-1 `^` shoulders in front of it. The forest's tier-1 shelf
 * stands `SHELF_RISE` (16); this is the same face at twice the height.
 */
export const ROCK_RISE = 32;
const ROCK_COURSE = ROCK_RISE / 2;
const ROCK_BLOCK = 32;
const LIP_INK = 2;

const isRock = (x: number, y: number): boolean => {
  const key = QUARRY_GATE.rows[y]?.[x];
  return key === 'X';
};

const regionAt = (x: number, y: number): GateRegionName | null => {
  const key = QUARRY_GATE.rows[y]?.[x];
  if (!key) return null;
  if (key === '=') return 'road';
  // The cut rock rides the limestone page: it is the Cutting's `block` key, so
  // it belongs with the stone, and keeping it off the spoil pages keeps them
  // to the terrace they describe.
  if (key === 'o' || key === '^' || key === 'X') return 'limestone';
  return x < 10 ? 'earth-west' : 'earth-east';
};

/** Which of the §3 materials a cell is painted in. */
const materialOf = (key: string | undefined): QuarryTone | null => {
  if (!key) return null;
  if (key === '=') return 'earth';
  if (key === 'o' || key === '^') return 'limestone';
  // Cut quarry rock: the Cutting's `^`/`A` block key, never spoil floor.
  if (key === 'X') return 'block';
  // Walls and cover stand on the terrace; their footprint is still ground, and
  // leaving it unpainted would change the registered page bounds.
  return 'spoil';
};

/** A soft join belongs between the road and the terrace it runs across; a wall base does not. */
const plain = (key: string | undefined): boolean => key === '.' || key === ',' || key === '=';

const clamp = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * Open terrace, the only ground a heap may lie on: the Cutting's fit rule in
 * the gate's reading of its rows. A heap reaching the road, the limestone, a
 * wall base or a cover cell is dropped whole by `heapFits`, never cut by that
 * boundary into a sliver.
 */
export const plainSpoil = (x: number, y: number): boolean => {
  const key = QUARRY_GATE.rows[y]?.[x];
  return materialOf(key) === 'spoil' && plain(key);
};

/** Logical cell coordinates of a world pixel. */
const logical = (wx: number, wy: number): { x: number; y: number } => ({
  x: ((wx - 768) / 64 + wy / 32) / 2,
  y: (wy / 32 - (wx - 768) / 64) / 2,
});
const rockAt = (wx: number, wy: number): boolean => {
  const { x, y } = logical(wx, wy);
  return isRock(Math.floor(x), Math.floor(y));
};
const offGrid = (wx: number, wy: number): boolean => {
  const { x, y } = logical(wx, wy);
  return QUARRY_GATE.rows[Math.floor(y)]?.[Math.floor(x)] === undefined;
};

/**
 * One pixel of the cut rock, painted the way `forest-raised-shelf.ts` stands
 * its shelf: the top is the footprint lifted by `ROCK_RISE`, and wherever the
 * ground under a pixel's top would already be off the rock, that pixel is the
 * block face instead, so the face stands straight up from the rock's
 * down-screen (+x/+y) edges inside the rules' own cells. The face is the
 * `block` row's shadow, never its pale tones: joint-tone joints on the
 * left-facing wall, ink joints on the right-facing one, turned further from
 * the light. It is one step lighter than the shelf's right wall (whose field is
 * the joint tone) because the rock shares the limestone page, and the page's
 * darkest window has to stay inside the §3 span of its brightest paving.
 */
function rockPixel(material: QuarryMaterial, wx: number, wy: number, rim: boolean): Rgb {
  let drop = 1;
  while (drop <= ROCK_RISE && rockAt(wx, wy + drop)) drop++;
  // Toward the exterior the rock stands one course over the surround's own
  // terrace, not two over the board's floor.
  const outward = offGrid(wx, wy + drop);
  if (drop > ROCK_RISE || (outward && drop > ROCK_COURSE)) {
    // The top, sampled where it stands, so its incident rides up with the lift.
    if (rim) return material.rimOf('block');
    const top = logical(wx, wy + ROCK_RISE);
    return material.colour('block', top.x, top.y);
  }
  const block = QUARRY_GROUND_TONES.block;
  const foot = logical(wx, wy + drop - 1);
  const exit = logical(wx, wy + drop);
  const right =
    Math.floor(exit.x) > Math.floor(foot.x) && Math.floor(exit.y) === Math.floor(foot.y);
  const height = drop - 1;
  const rise = outward ? ROCK_COURSE : ROCK_RISE;
  if (drop > rise - LIP_INK || height < LIP_INK) return material.ink;
  const course = Math.floor(height / ROCK_COURSE);
  // Blocks break joint course to course, and each runs its own length.
  const run = Math.floor(wx) + course * (ROCK_BLOCK / 2);
  const index = Math.floor(run / ROCK_BLOCK);
  const jointAt =
    index * ROCK_BLOCK + 4 + Math.floor(tileNoise(index, course, 7) * (ROCK_BLOCK - 8));
  const joint = height % ROCK_COURSE === 0 || run === jointAt;
  if (right) return joint ? material.ink : parseHex(block.shadow);
  return parseHex(joint ? block.joint : block.shadow);
}

export function packGateGround(material: QuarryMaterial): Map<GateRegionName, Image> {
  const images = new Map(
    QUARRY_GATE_REGION_NAMES.map((name) => [
      name,
      newImage(QUARRY_GATE_PAGE.width, QUARRY_GATE_PAGE.height),
    ]),
  );
  for (let py = 0; py < QUARRY_GATE_PAGE.height; py++)
    for (let px = 0; px < QUARRY_GATE_PAGE.width; px++) {
      const wx = QUARRY_GATE_PAGE.x + px + 0.5,
        wy = QUARRY_GATE_PAGE.y + py + 0.5;
      const gx = ((wx - 768) / 64 + wy / 32) / 2,
        gy = (wy / 32 - (wx - 768) / 64) / 2;
      const x = Math.floor(gx),
        y = Math.floor(gy);
      const name = regionAt(x, y);
      if (!name) continue;
      const key = QUARRY_GATE.rows[y]?.[x];
      const own = materialOf(key);
      if (!own) continue;

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
        const neighbourKey = QUARRY_GATE.rows[y + oy]?.[x + ox];
        const other = materialOf(neighbourKey);
        if (!other || other === own) continue;
        const edgeDistance = ox < 0 ? gx - x : ox > 0 ? x + 1 - gx : oy < 0 ? gy - y : y + 1 - gy;
        if (!plain(key) || !plain(neighbourKey)) {
          if (edgeDistance < edge) {
            edge = edgeDistance;
            lit = ox < 0 || oy < 0;
          }
          continue;
        }
        const width = 0.16 + 0.03 * (0.5 + 0.5 * Math.sin(x * 4.1 + y * 6.7));
        const share = 0.5 * clamp((width - edgeDistance) / width);
        if (share > mix) {
          mix = share;
          swapTone = other;
        }
      }
      let tone: QuarryTone = swapTone && tileNoise(px, py, 5) < mix ? swapTone : own;

      let heap: Rgb | null = null;
      if (tone === 'earth') {
        // The road: haul tracks only. Spoil heaps do not sit in a cart lane.
        tone = material.trackMark(gx, gy) ?? tone;
      } else if (tone === 'spoil' && heapFits(gx, gy, plainSpoil)) {
        // The terrace either side: low uninked mounds of spoil, so neither
        // earth page is a quarter-frame of bare material, painted as the
        // terrace's own texture. The gate has no cover cell (its cover is
        // Pella's timber), so no heap here may read as one. Only whole heaps.
        heap = material.heapMark(gx, gy);
      }

      const rgb =
        edge < INK_HALF
          ? material.ink
          : key === 'X'
            ? rockPixel(material, wx, wy, lit && edge < INK_HALF + RIM_WIDTH)
            : lit && edge < INK_HALF + RIM_WIDTH
              ? material.rimOf(tone)
              : (heap ?? material.colour(tone, gx, gy));
      setPixel(images.get(name)!, px, py, [rgb[0], rgb[1], rgb[2], 255]);
    }
  return images;
}

/**
 * A clipped alpha edge filters against the procedural base during oblique
 * scaling. Extend the authored edge by two world pixels so adjacent regions
 * overlap instead of exposing that gray fallback seam; it changes no map cell.
 */
function bleedEdges(image: Image, pixels = 2): void {
  for (let pass = 0; pass < pixels; pass++) {
    const previous = new Uint8Array(image.data);
    for (let y = 0; y < image.height; y++)
      for (let x = 0; x < image.width; x++) {
        const index = (y * image.width + x) * 4;
        if ((previous[index + 3] ?? 0) !== 0) continue;
        for (const [dx, dy] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ] as const) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= image.width || ny >= image.height) continue;
          const neighbor = (ny * image.width + nx) * 4;
          if ((previous[neighbor + 3] ?? 0) === 0) continue;
          image.data[index] = previous[neighbor] ?? 0;
          image.data[index + 1] = previous[neighbor + 1] ?? 0;
          image.data[index + 2] = previous[neighbor + 2] ?? 0;
          image.data[index + 3] = previous[neighbor + 3] ?? 255;
          break;
        }
      }
  }
}

/** The finished gate plates, exactly as they are encoded; see `buildQuarryGround`. */
export async function buildGateGround(): Promise<
  Map<GateRegionName, { image: Image; x: number; y: number }>
> {
  // The gate's road is two rows wide, so its pair of ruts runs inside them.
  const images = packGateGround(await loadQuarryMaterial({ centre: 5.5, offset: 0.5 }));
  const built = new Map<GateRegionName, { image: Image; x: number; y: number }>();
  for (const [name, image] of images) {
    bleedEdges(image);
    const bounds = alphaBounds(image);
    if (!bounds) throw new Error(`Empty local ground region ${name}.`);
    built.set(name, {
      image: crop(image, bounds),
      x: QUARRY_GATE_PAGE.x + bounds.x,
      y: QUARRY_GATE_PAGE.y + bounds.y,
    });
  }
  return built;
}

export async function writeGateGround(): Promise<{
  regions: {
    name: string;
    url: string;
    x: number;
    y: number;
    width: number;
    height: number;
    bytes: number;
  }[];
  totalBytes: number;
}> {
  const built = await buildGateGround();
  const outDir = 'public/art/maps/quarry-gate-scene';
  mkdirSync(outDir, { recursive: true });
  const regions = [];
  let totalBytes = 0;
  for (const [name, { image, x, y }] of built) {
    const bytes = await encodeWebp(image, QUARRY_GROUND_QUALITY, true);
    writeFileSync(`${outDir}/${name}.webp`, bytes);
    totalBytes += bytes.length;
    regions.push({
      name,
      url: `art/maps/quarry-gate-scene/${name}.webp`,
      x,
      y,
      width: image.width,
      height: image.height,
      bytes: bytes.length,
    });
  }
  if (totalBytes > 240 * 1024)
    throw new Error(`Modular quarry ground exceeds 240KiB: ${totalBytes}.`);
  mkdirSync('art/raw/quarry-gate', { recursive: true });
  writeFileSync(
    'art/raw/quarry-gate/modular-ground-registration.json',
    JSON.stringify(
      {
        source: [
          'public/art/maps/ba-dan-scene/western-approach-ground.webp',
          'public/art/maps/ba-dan-scene/courtyard-ground.webp',
        ],
        page: QUARRY_GATE_PAGE,
        regions,
        totalBytes,
      },
      null,
      2,
    ),
  );
  return { regions, totalBytes };
}

if (process.argv[1]?.endsWith('quarry-modular-ground.ts')) {
  console.log(await writeGateGround());
}
