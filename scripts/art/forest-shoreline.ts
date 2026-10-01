/**
 * Pack the pond: its damp bank, a bounded exterior feather, a ragged bite into
 * the outer water cells so the pond does not read as the rules' eight-cell
 * cross, and the bed the water sits on.
 *
 *   node --import tsx scripts/art/forest-shoreline.ts [--audit]
 *
 * The runtime water layer still covers every water cell, exactly as the rules
 * do — it lays a 0.4-alpha film over the tile. What this layer adds is what the
 * camera sees through that film: the authored dry material reaches a little way
 * inside the outermost cells by a seeded, smoothly varying amount, so the
 * boundary between wet and dry wanders the way a real bank does instead of
 * tracing the tile polygon; and the rest of the water carries a painted bed
 * that deepens away from the shore, so the middle of the pond reads as deeper
 * water over a visible bottom rather than as a flat teal field (ADR 0045).
 *
 * **What DL-2 W2b changed.** The geometry above is untouched. What the geometry
 * is painted *with* is no longer the four-quadrant forest atlas — the bank was
 * that atlas's ochre and the bed was the same ochre darkened, which is why the
 * pond's margin was the odd material on a board whose road and verges had
 * already been re-keyed to the village's hand. Both now come from
 * `forest-village-material.ts`, in the DL-2 §3 water-margin key: the bank is
 * the **damp margin** `#8e7049` over the road's own packed-earth shadow, and
 * under the water film it keeps the margin's base and rim (`WET_BANK`); the
 * bed is `#2a5e77` falling to a deeper second flat tone; and the wet line is
 * the bible's `#1b1410` ink alone. Two flat tones per material, no gradient;
 * the bed's depth is spent on *which* of its two tones a pixel takes, never on
 * blending them, exactly as the route plate spends its feather.
 *
 * **What the DL-2 W5 gate changed.** The wet line used to carry a band of the
 * §3 `#7ec8e3` edge on its water side. Under the film it read as a UI
 * selection ring traced round the pond, so the ink now meets the bed
 * directly. And the bank under the film was the margin's shadow, which the
 * film turned into a grey-olive band like a strip of mud round the water; it
 * now takes the margin's base and rim, so the bank reads as the same earth
 * seen through shallow water. Both changes reach the Cutting's pool too,
 * since it is packed here.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { FOREST_POND_PATCH, FOREST_WATER_CELLS } from '../../src/content/scenes/forestRoad';
import type { Vec2 } from '../../src/core/types';
import { newImage, parseHex, setPixel, writePng } from './lib/image';
import { encodeWebp } from './lib/webp';
import {
  FOREST_GROUND_QUALITY,
  FOREST_PIECE_TONES,
  loadForestMaterial,
} from './forest-village-material';
import type { Rgb, VillagePalette } from './forest-village-material';

export const SHORE_LIMIT = 0.12;
export const COVER_LIMIT = 0.08;
/** The deepest the dry bank reaches inside a water cell, in cells. */
export const SHORE_BITE = 0.3;
/** The innermost sliver of a bite, feathered so wet and dry meet softly. */
export const BITE_FEATHER = 0.05;
/** The narrowest a bite gets, as a fraction of `SHORE_BITE`. */
export const BITE_FLOOR = 0.3;
/** How far in the bed reaches its deep tone, in cells, and over what band. */
export const BED_DEEP_AT = 0.75;
export const BED_DEEP_BAND = 0.6;
/**
 * The bible's uniform ink, in logical cells. One step of a tile across either
 * kind of cell edge is `hypot(64, 32)` screen pixels, so 2 px of ink is this
 * much of a tile — the same arithmetic `forest-route-ground.ts` uses, so the
 * pond's line matches the road's.
 */
const TILE_DIAGONAL = Math.hypot(64, 32);
export const INK_HALF = 1 / TILE_DIAGONAL;
/** World pixels per cell, and packed pixels per cell at this density. */
const CELL = 64;
const DENSITY = 2;
export const SHORE_OUTPUT = 'public/art/maps/forest-scene/pond-bank.webp';

/**
 * A pond to pack: the scene box its plate is drawn into and the water cells it
 * banks. The forest's pond by default; the Cutting's pool passes its own
 * (`quarry-route-ground.ts`), so both are painted by this one packer.
 */
export interface Pond {
  readonly patch: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly cells: readonly Vec2[];
  /**
   * Round the shoreline off the grid's steps (`organicShore`). The forest's
   * pond and creek take it, and so does the Cutting's runoff pool (M5).
   */
  readonly organic?: boolean;
  /**
   * The land the shore stands in, where it grows over an organic bank: given
   * a logical point, the colour that ground paints there. A creek in grass
   * passes the verge, which the grass plates paint on the same lattice, so the
   * grass runs on over the bank in clumps instead of meeting it along a band.
   */
  readonly overgrowth?: (x: number, y: number) => Rgb;
  /**
   * Keep an organic creek's grass/bank boundary on the same contour as its
   * waterline. Ponds retain their independent grass wander; creek banks cross
   * the apron and must not grow a separate brown tooth at the rim.
   */
  readonly bankFollowsWater?: boolean;
}

/**
 * Whether the land's overgrowth covers a bank pixel `into` cells back from the
 * wet line (`Infinity` on the damp margin outside the water). The grass holds
 * everything past a second wandering line, from a hair's breadth off the water
 * to most of a bank's width, so the bare bank is a strip between two organic
 * lines and never reaches the cells' own edge.
 */
export function overgrown(x: number, y: number, into: number, bankFollowsWater = false): boolean {
  return bankFollowsWater
    ? into > GRASS_LINE
    : into > GRASS_LINE + GRASS_LINE_WANDER * shoreNoise(x * 3.7 + 1.7, y * 3.7 + 9.1);
}
/** How far back from the wet line the grass takes over, in cells, and how far that wanders. */
export const GRASS_LINE = 0.03;
export const GRASS_LINE_WANDER = 0.26;
export const FOREST_POND: Pond = {
  patch: FOREST_POND_PATCH,
  cells: FOREST_WATER_CELLS,
  organic: true,
};

/**
 * The organic shore's smoothing radius, in cells. The water's cells are
 * blurred by a separable tent this wide, so a straight run of edge sits at
 * 0.5, the corner of a water cell that sticks out at 0.25 and the corner of
 * dry land that pokes in at 0.75. Under half a cell's reach past 0.5, so a
 * water cell's middle always reads close to 1 however it is surrounded.
 */
export const SHORE_BLUR = 0.65;
/** Where the wet line sits on the blurred water, and how far it wanders. */
export const SHORE_LEVEL = 0.66;
export const SHORE_LEVEL_WANDER = 0.5;
/** Where the damp margin outside the cells gives out, and how far that wanders. */
export const MARGIN_LEVEL = 0.36;
export const MARGIN_LEVEL_WANDER = 0.5;
/** The margin's own feather, in blurred-water units. */
export const MARGIN_FEATHER = 0.08;

/** The mass of a tent of half-width `SHORE_BLUR` below `u`. */
function tentBelow(u: number): number {
  const r = SHORE_BLUR;
  if (u <= -r) return 0;
  if (u >= r) return 1;
  return u <= 0 ? (u + r) ** 2 / (2 * r * r) : 1 - (r - u) ** 2 / (2 * r * r);
}

/**
 * The pond's cells blurred by the tent at a logical point: 1 deep in open
 * water, 0 well clear of it. Separable and exact, so its level lines are
 * smooth curves that round a staircase of cells off into a shore.
 */
export function blurredWater(x: number, y: number, cells: readonly Vec2[]): number {
  let sum = 0;
  for (const c of cells) {
    if (Math.abs(c.x + 0.5 - x) >= SHORE_BLUR + 0.5 || Math.abs(c.y + 0.5 - y) >= SHORE_BLUR + 0.5)
      continue;
    sum +=
      (tentBelow(c.x + 1 - x) - tentBelow(c.x - x)) * (tentBelow(c.y + 1 - y) - tentBelow(c.y - y));
  }
  return sum;
}

/**
 * Straight-line distance, in cells, from a point in the water to the nearest
 * cell that is not water. Measured on the ground plane rather than across
 * packed pixels, so a line held at a fixed distance from the land rounds each
 * corner of land that pokes into the water on a circle.
 */
const WATER_SETS = new WeakMap<readonly Vec2[], ReadonlySet<string>>();
export function landDistance(x: number, y: number, cells: readonly Vec2[]): number {
  let water = WATER_SETS.get(cells);
  if (!water) {
    water = new Set(cells.map((c) => `${c.x},${c.y}`));
    WATER_SETS.set(cells, water);
  }
  const cx = Math.floor(x),
    cy = Math.floor(y);
  let best = 2;
  for (let oy = -2; oy <= 2; oy++)
    for (let ox = -2; ox <= 2; ox++) {
      const lx = cx + ox,
        ly = cy + oy;
      if (water.has(`${lx},${ly}`)) continue;
      const dx = Math.max(lx - x, x - lx - 1, 0),
        dy = Math.max(ly - y, y - ly - 1, 0);
      best = Math.min(best, Math.hypot(dx, dy));
    }
  return best;
}

/**
 * How far a point inside the water lies on the wet side of the organic line,
 * in cells (negative on the bank). Two lines, and the bank takes whichever
 * reaches further in: one on the blurred water's wandering level, which rounds
 * off the corners water cells push out; one at the bite's wandering depth
 * from the land, which rounds the corners the land pushes in.
 */
export function organicShore(x: number, y: number, cells: readonly Vec2[]): number {
  const level = SHORE_LEVEL + SHORE_LEVEL_WANDER * (shoreNoise(x * 1.9 + 3.1, y * 1.9 + 8.3) - 0.5);
  const e = 0.01;
  const b = blurredWater(x, y, cells);
  const gx = (blurredWater(x + e, y, cells) - blurredWater(x - e, y, cells)) / (2 * e);
  const gy = (blurredWater(x, y + e, cells) - blurredWater(x, y - e, cells)) / (2 * e);
  const fromLevel = (b - level) / Math.max(0.5, Math.hypot(gx, gy));
  return Math.min(fromLevel, landDistance(x, y, cells) - biteDepth(x, y));
}

/**
 * The damp margin's alpha at a dry point just outside the water: opaque near
 * the shore and feathered out where the blurred water falls to a wandering
 * level, so the ring's outer edge is a soft wandering line rather than the
 * cells' outline at a fixed offset.
 */
function organicMargin(x: number, y: number, cells: readonly Vec2[]): number {
  const level =
    MARGIN_LEVEL + MARGIN_LEVEL_WANDER * (shoreNoise(x * 2.3 + 17.9, y * 2.3 + 5.3) - 0.5);
  const b = blurredWater(x, y, cells);
  return Math.round(255 * clamp((b - level) / MARGIN_FEATHER));
}

export function shorePosition(px: number, py: number, density = 2, pond: Pond = FOREST_POND) {
  const worldX = pond.patch.x + (px + 0.5) / density;
  const worldY = pond.patch.y + (py + 0.5) / density;
  const dx = (worldX - 768) / 64,
    dy = worldY / 32;
  return { x: (dx + dy) / 2, y: (dy - dx) / 2 };
}

/**
 * How far outside the water a logical point lies, in cells; zero on water. The
 * forest's pond by default; the Cutting's pool passes its own cells
 * (`quarry-route-ground.ts`), so both banks are measured the same way.
 */
export function shoreDistance(
  x: number,
  y: number,
  cells: readonly Vec2[] = FOREST_WATER_CELLS,
): number {
  return Math.min(...cells.map((c) => Math.max(c.x - x, x - c.x - 1, c.y - y, y - c.y - 1, 0)));
}

/**
 * How deep the dry bank bites into the water at a point, in cells. Smooth
 * value noise in cell space, so neighbouring shore pixels agree and the bite
 * arrives in clumps that read as a bank rather than per-pixel speckle.
 */
export function biteDepth(x: number, y: number): number {
  return SHORE_BITE * (BITE_FLOOR + (1 - BITE_FLOOR) * shoreNoise(x * 2.6, y * 2.6));
}

/** Two octaves of value noise over a seeded integer lattice. */
function shoreNoise(x: number, y: number): number {
  return (valueNoise(x, y) * 2 + valueNoise(x * 2.1 + 11.3, y * 2.1 + 4.7)) / 3;
}

function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash01(ix, iy);
  const b = hash01(ix + 1, iy);
  const c = hash01(ix, iy + 1);
  const d = hash01(ix + 1, iy + 1);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

function hash01(ix: number, iy: number): number {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const smooth = (t: number): number => {
  const c = clamp(t);
  return c * c * (3 - 2 * c);
};

/**
 * Whether a wet point takes the bed's deep tone rather than its shelf tone.
 *
 * The deep tone's territory is a pool whose edge wanders across
 * `BED_DEEP_BAND`: a point is deep where its depth, as a smoothstep across the
 * band, clears a smooth value-noise field. The field is continuous and sampled
 * in cell space on whole-number frequencies, so the boundary is one wandering
 * line rather than a dither — no pixel, clump or hash decides it on its own —
 * and every pixel is still one of exactly two flat tones. The village lawn's
 * own incident then flips the class in its minority share, which leaves silt
 * flecks on the shelf and pale submerged stones in the deep.
 */
export function bedIsDeep(
  material: Pick<VillagePalette<'bed'>, 'classOf'>,
  x: number,
  y: number,
  inside: number,
): boolean {
  const band = smooth((inside - BED_DEEP_AT) / BED_DEEP_BAND + 0.5);
  const deep = band > shoreNoise(x * 3 + 7, y * 3 + 5);
  return deep !== (material.classOf('bed', x, y) === 'shadow');
}

/** How far inside the water a packed pixel sits, in cells; zero outside it. */
export function pondInset(width: number, height: number, pond: Pond = FOREST_POND): Float64Array {
  const far = 1e9;
  const inset = new Float64Array(width * height);
  for (let py = 0; py < height; py++)
    for (let px = 0; px < width; px++) {
      const { x, y } = shorePosition(px, py, DENSITY, pond);
      inset[py * width + px] = shoreDistance(x, y, pond.cells) <= 0 ? far : 0;
    }
  const pixelsPerCell = CELL * DENSITY;
  const step = (index: number, previous: number, cost: number): void => {
    const value = inset[previous];
    if (value !== undefined && value + cost < (inset[index] ?? far)) inset[index] = value + cost;
  };
  for (let py = 0; py < height; py++)
    for (let px = 0; px < width; px++) {
      const index = py * width + px;
      if (px > 0) step(index, index - 1, 1);
      if (py > 0) step(index, index - width, 1);
      if (px > 0 && py > 0) step(index, index - width - 1, 2);
      if (px + 1 < width && py > 0) step(index, index - width + 1, 2);
    }
  for (let py = height - 1; py >= 0; py--)
    for (let px = width - 1; px >= 0; px--) {
      const index = py * width + px;
      if (px + 1 < width) step(index, index + 1, 1);
      if (py + 1 < height) step(index, index + width, 1);
      if (px + 1 < width && py + 1 < height) step(index, index + width + 1, 2);
      if (px > 0 && py + 1 < height) step(index, index + width - 1, 2);
    }
  for (let index = 0; index < inset.length; index++) {
    const value = inset[index] ?? 0;
    inset[index] = value >= far ? 0 : value / pixelsPerCell;
  }
  return inset;
}

const BED = {
  shelf: parseHex(FOREST_PIECE_TONES.bed.base),
  deep: parseHex(FOREST_PIECE_TONES.bed.shadow),
};
/**
 * The bank under the water film: the damp margin's base as the field and its
 * rim where the lawn's rhythm lifts a patch. The film already cools and darkens
 * whatever it covers, so the bank needs no darker tone of its own to read as
 * wet; the margin's shadow under it read as a grey-olive band of mud.
 */
export const WET_BANK = {
  field: FOREST_PIECE_TONES.margin.base,
  lifted: FOREST_PIECE_TONES.margin.rim,
} as const;
const WET_BANK_RGB = { field: parseHex(WET_BANK.field), lifted: parseHex(WET_BANK.lifted) };

/** What a wet pixel shows through the film: the ink, the bank or the bed. */
interface WetPaint {
  readonly part: 'ink' | 'bank' | 'bed';
  readonly rgb: Rgb;
  /** The bed's deep tone rather than its shelf tone. */
  readonly deep: boolean;
}

/**
 * One wet pixel of a pond, `inside` cells in from the water's edge and
 * `fromLine` cells on the water side of the wet line (negative on the bank).
 * The forest pond and the Cutting's pool both paint every wet pixel here,
 * which is what makes them one water language rather than two that happen to
 * share tones.
 */
function wetPixel(
  material: Pick<VillagePalette<'margin' | 'bed'>, 'classOf' | 'ink'>,
  x: number,
  y: number,
  inside: number,
  fromLine: number,
): WetPaint {
  // The bed is opaque across every wet pixel, so the 0.4-alpha water film
  // always tints authored bottom rather than whatever ground the pond
  // happens to sit on (ADR 0045). The wet line itself is the boundary
  // between the bite and the bed, which is where the ink belongs: the
  // tile edge is not a material edge, and never was. The ink meets the bed
  // directly: a pale band on its water side read as a selection ring.
  const part = Math.abs(fromLine) < INK_HALF ? 'ink' : fromLine < 0 ? 'bank' : 'bed';
  if (part === 'ink') return { part, rgb: material.ink, deep: false };
  if (part === 'bank')
    return {
      part,
      rgb: material.classOf('margin', x, y) === 'rim' ? WET_BANK_RGB.lifted : WET_BANK_RGB.field,
      deep: false,
    };
  const deep = bedIsDeep(material, x, y, inside);
  return { part, rgb: deep ? BED.deep : BED.shelf, deep };
}

/**
 * The pond's bank and bed. `material` is any palette that binds §3's damp
 * margin and bed: the forest's, or the quarry's, which reads them from the
 * same table (`quarry-village-material.ts`).
 */
export function packShoreline(
  material: Pick<VillagePalette<'margin' | 'bed'>, 'colour' | 'classOf' | 'ink'>,
  pond: Pond = FOREST_POND,
) {
  const { width, height } = pond.patch;
  const out = newImage(width * DENSITY, height * DENSITY);
  const inset = pondInset(out.width, out.height, pond);
  let bitePixels = 0,
    deepestBitePixels = 0,
    bedPixels = 0,
    deepBedPixels = 0,
    inkPixels = 0;
  /*
   * Per-material means, in the same Rec. 709 luma `forest-ground-measure.ts`
   * reads. The plate holds materials that are supposed to differ — the damp
   * margin on dry ground, the same margin gone wet under the film, and the
   * bed — so its whole-plate window span is a wet-against-dry step, not the
   * baked ramp the DL-2 §3 bar is aimed at. These are the numbers that say
   * whether any one of them has drifted; `dry` is the one the route's tone
   * band applies to.
   */
  const bands = { dry: { n: 0, sum: 0 }, bank: { n: 0, sum: 0 }, bed: { n: 0, sum: 0 } };
  const record = (band: { n: number; sum: number }, rgb: readonly number[]): void => {
    band.n++;
    band.sum += 0.2126 * (rgb[0] ?? 0) + 0.7152 * (rgb[1] ?? 0) + 0.0722 * (rgb[2] ?? 0);
  };
  for (let py = 0; py < out.height; py++)
    for (let px = 0; px < out.width; px++) {
      const { x, y } = shorePosition(px, py, DENSITY, pond);
      const distance = shoreDistance(x, y, pond.cells);
      const depth = biteDepth(x, y);
      const inside = inset[py * out.width + px] ?? 0;
      /*
       * The organic shore's damp margin gives out on the blurred water, not at
       * a fixed offset from the cells, so it has no alpha to spend where the
       * blur says dry ground.
       */
      const marginAlpha =
        pond.organic && distance > 0 && inside <= 0 ? organicMargin(x, y, pond.cells) : 0;
      const dryOutside = pond.organic ? marginAlpha > 0 : distance > 0 && distance < SHORE_LIMIT;
      /*
       * Inside a water cell the bank reaches in by `depth`, so the wet outline
       * wanders instead of running along the tile's own edge. The bite is
       * bounded well below half a cell, so the middle of every water cell —
       * where a unit stands and where the runtime water reads as water — is
       * never covered.
       *
       * An organic shore also takes the bank in wherever the blurred water
       * falls short of its wandering level. That rounds off every corner a
       * water cell pushes out, so the wet line runs as one curve across the
       * steps of the cells instead of stepping with them; the bite still
       * rounds the land that pokes into the water.
       */
      const wet = inside > 0;
      const fromLine = wet && pond.organic ? organicShore(x, y, pond.cells) : inside - depth;
      const dryInside = wet && fromLine < 0;
      if (!dryOutside && !wet) continue;

      let rgb: readonly number[];
      let alpha = 255;
      if (wet) {
        const paint = wetPixel(material, x, y, inside, fromLine);
        rgb =
          pond.overgrowth &&
          paint.part === 'bank' &&
          overgrown(x, y, -fromLine - INK_HALF, pond.bankFollowsWater)
            ? pond.overgrowth(x, y)
            : paint.rgb;
        if (paint.part === 'ink') inkPixels++;
        if (dryInside) {
          bitePixels++;
          record(bands.bank, rgb);
          if (inside > SHORE_BITE * 0.75) deepestBitePixels++;
        } else {
          bedPixels++;
          record(bands.bed, rgb);
          if (paint.deep) deepBedPixels++;
        }
      } else {
        // Nothing lies under this band, outside the water: it keeps the damp
        // margin, opaque against the bank and feathered out to the dry ground
        // so the plate's own rim never ends on a ruled line.
        rgb =
          pond.overgrowth && overgrown(x, y, Infinity)
            ? pond.overgrowth(x, y)
            : material.colour('margin', x, y);
        record(bands.dry, rgb);
        alpha = pond.organic
          ? marginAlpha
          : distance <= COVER_LIMIT
            ? 255
            : Math.round((255 * (SHORE_LIMIT - distance)) / (SHORE_LIMIT - COVER_LIMIT));
      }
      setPixel(out, px, py, [rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0, alpha]);
    }
  return {
    image: out,
    bitePixels,
    deepestBitePixels,
    bedPixels,
    deepBedPixels,
    inkPixels,
    dryMean: bands.dry.n ? bands.dry.sum / bands.dry.n : 0,
    bankMean: bands.bank.n ? bands.bank.sum / bands.bank.n : 0,
    bedMean: bands.bed.n ? bands.bed.sum / bands.bed.n : 0,
  };
}

export async function main() {
  const result = packShoreline(await loadForestMaterial());
  mkdirSync('public/art/maps/forest-scene', { recursive: true });
  const bytes = await encodeWebp(result.image, FOREST_GROUND_QUALITY, true);
  writeFileSync(SHORE_OUTPUT, bytes);
  if (process.argv.includes('--audit')) writePng('.shots/pond/packed.png', result.image);
  console.log({
    width: result.image.width,
    height: result.image.height,
    bytes: bytes.length,
    bitePixels: result.bitePixels,
    deepestBitePixels: result.deepestBitePixels,
    bedPixels: result.bedPixels,
    deepBedPixels: result.deepBedPixels,
    inkPixels: result.inkPixels,
    dryMean: Number(result.dryMean.toFixed(1)),
    bankMean: Number(result.bankMean.toFixed(1)),
    bedMean: Number(result.bedMean.toFixed(1)),
  });
}
if (process.argv[1]?.endsWith('forest-shoreline.ts')) await main();
