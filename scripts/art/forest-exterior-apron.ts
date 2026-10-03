/**
 * Carry the forest road's own ground outside the board.
 *
 * The village apron solved the same defect by painting procedural terrace
 * colours, because the village's own cells are procedural there. The forest's
 * ground is authored texture from a reviewed material sheet, and a flat fill
 * beside it would read as exactly the tone step the route is already criticised
 * for. So this plate does not invent a colour: it walks back into the board
 * along the outward normal and continues the authored pixels it finds —
 * `grass-north`, `grass-south` and `route-ground`, in their own draw order —
 * for about two tiles, fading the page back in before the camera can follow.
 *
 * The road therefore leaves the board instead of ending on it: the route is a
 * stretch of a longer road, and the reference reads that way. Inside the board
 * the plate paints only the seam band the grass packs leave open, and never over
 * ground the scene already paints opaque, which `forest-exterior-apron.test.ts`
 * asserts.
 *
 * npx tsx scripts/art/forest-exterior-apron.ts
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import decode, { init as initWebpDecode } from '@jsquash/webp/decode.js';
import {
  FOREST_APRON_BANDS,
  FOREST_APRON_FADE,
  FOREST_APRON_MAP,
  FOREST_APRON_SOLID,
  FOREST_APRON_SEAM,
  FOREST_EXTERIOR_APRON,
  FOREST_ROAD_SCENE,
} from '../../src/content/scenes/forestRoad';
import { tileNoise } from '../../src/render/painters/shapes';
import { transitionCluster } from './ba-dan-garden';
import { writeApronPlates } from './lib/apron-plates';
import { newImage, pixelAt, setPixel } from './lib/image';
import type { Image } from './lib/image';

/** The bands are written here, one file per entry in `FOREST_APRON_BANDS`. */
export const DIRECTORY = 'public/art/maps/forest-scene';
export const STEM = 'exterior-apron';
export const QUALITY = 86;
/** Authored terrain is fully faded out by this far outside the rim, in tiles. */
export const APRON_FADE = FOREST_APRON_FADE;
/** The exterior trees remain on fully painted ground; only the outer tile dissolves. */
export const APRON_SOLID = FOREST_APRON_SOLID;
/** Fine flat steps keep the fade soft without introducing a translucent haze. */
export const FOREST_APRON_ALPHA_STEPS = [
  255, 238, 221, 204, 187, 170, 153, 136, 119, 102, 85, 68, 51, 34, 17, 4,
] as const;
/**
 * How far inside the rim the plate may reach to close the authored ground's own
 * feather. The grass packs fade to alpha 0 across their outermost ~0.2 tiles; on
 * the page that was invisible, and beside textured ground it reads as a pale
 * hem. The plate fills that band, but only where the scene's own ground leaves
 * the page showing (`GUARD_ALPHA`), so it never overpaints authored ground.
 *
 * The value itself lives on the scene, because which pixels are the apron's is
 * geometry the scene registers, not a brush choice here.
 */
export const APRON_SEAM = FOREST_APRON_SEAM;
/** Ground this opaque is the scene's own painting and is left alone. */
export const GUARD_ALPHA = 250;
/**
 * How far either side of the painted band the clear pixels still carry the
 * neighbouring ground's colour, in tiles: past a lossy macroblock's width.
 */
export const RIM_BLEED = 0.4;
/**
 * How far inside the board the continuation may reach to find real ground. The
 * enlarged NE bank reaches five cells in from the eastern rim, so the walk has
 * to be able to cross it to the grass bank it is cut into.
 */
const SAMPLE_REACH = 6;
/** The walk's stride along the normal, in tiles. */
const SAMPLE_STEP = 0.08;
/** Tile centre of logical (0,0) in scene-local pixels, as every piece uses it. */
const ORIGIN = { x: 768, y: 0 } as const;
const TILE = { width: 64, height: 32 } as const;
/**
 * The plates whose pixels the apron continues, in the scene's own draw order.
 * The pond, the raised shelf and the rubble keep their authored edges: they are
 * objects standing on the ground, not ground to be smeared outward.
 */
const BASE_PLATES = [
  'grass-north.webp',
  'grass-south.webp',
  'route-ground.webp',
  /*
   * The creek is a watercourse, not an object standing on the ground: like the
   * road it leaves the board. Left out, the mirror beyond the south rim found
   * no ground in the pools, reached on past them and carried row 8's cart track
   * out past the creek as a strip of paving.
   */
  'creek-west.webp',
  'creek-east.webp',
] as const;
/** The plates that carry their own water past the rim. */
const WATERCOURSE_PLATES = ['creek-west.webp', 'creek-east.webp'] as const;
/** Every ground plate, in draw order, for the overpaint guard. */
const GUARD_PLATES = [
  'grass-north.webp',
  'grass-south.webp',
  'route-ground.webp',
  'pond-bank.webp',
  'creek-west.webp',
  'creek-east.webp',
  'raised-shelf.webp',
  'rubble.webp',
] as const;

let decoderReady: Promise<void> | null = null;

async function readWebp(path: string): Promise<Image> {
  if (!decoderReady) {
    const require = createRequire(import.meta.url);
    const wasm = readFileSync(require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm'));
    decoderReady = WebAssembly.compile(wasm).then((module) => initWebpDecode(module));
  }
  await decoderReady;
  const bytes = readFileSync(path);
  const decoded = await decode(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  return { width: decoded.width, height: decoded.height, data: new Uint8Array(decoded.data) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Forest-specific outer-tile fade. It reaches a near-clear step before the crop edge. */
export function forestApronAlpha(depth: number, x: number, y: number): number {
  if (depth <= APRON_SOLID) return 255;
  if (depth >= APRON_FADE) return 0;
  const wander =
    (transitionCluster(x * 0.5, y * 0.5, 91) - 0.5) *
    0.12 *
    clamp((APRON_FADE - depth) / 0.25, 0, 1);
  const progress = clamp((depth + wander - APRON_SOLID) / (APRON_FADE - APRON_SOLID), 0, 1);
  const index = Math.min(
    FOREST_APRON_ALPHA_STEPS.length - 1,
    Math.floor(progress * FOREST_APRON_ALPHA_STEPS.length),
  );
  return FOREST_APRON_ALPHA_STEPS[index] ?? 0;
}

/** Plate-local image pixels to logical map coordinates; the inverse projection. */
export function apronLogical(px: number, py: number): { x: number; y: number } {
  const dx = (FOREST_EXTERIOR_APRON.x + px + 0.5 - ORIGIN.x) / TILE.width;
  const dy = (FOREST_EXTERIOR_APRON.y + py + 0.5 - ORIGIN.y) / TILE.height;
  return { x: (dx + dy) / 2, y: (dy - dx) / 2 };
}

/** Scene-local pixels for a logical map point; the forward projection. */
function scenePixel(x: number, y: number): { x: number; y: number } {
  return { x: ORIGIN.x + (x - y) * TILE.width, y: ORIGIN.y + (x + y) * TILE.height };
}

/** How far outside the board this point is, in logical tiles; 0 on the board. */
export function apronDepth(x: number, y: number): number {
  const { width, height } = FOREST_APRON_MAP;
  return Math.max(-x, x - width, -y, y - height);
}

/** The board boundary this exterior point is leaving, and the way back in. */
export function apronInward(x: number, y: number): { x: number; y: number; depth: number } {
  const { width, height } = FOREST_APRON_MAP;
  const sides = [
    { x: 1, y: 0, depth: -x },
    { x: -1, y: 0, depth: x - width },
    { x: 0, y: 1, depth: -y },
    { x: 0, y: -1, depth: y - height },
  ];
  return sides.reduce((best, side) => (side.depth > best.depth ? side : best));
}

export type ApronPlate = { readonly image: Image; readonly x: number; readonly y: number };

/** Alpha-over the authored plates into one buffer, in their own draw order. */
export function baseField(plates: readonly ApronPlate[]): Image {
  const field = newImage(FOREST_EXTERIOR_APRON.width, FOREST_EXTERIOR_APRON.height);
  for (const plate of plates) {
    const left = plate.x - FOREST_EXTERIOR_APRON.x;
    const top = plate.y - FOREST_EXTERIOR_APRON.y;
    for (let py = 0; py < plate.image.height; py++) {
      const y = top + py;
      if (y < 0 || y >= field.height) continue;
      for (let px = 0; px < plate.image.width; px++) {
        const x = left + px;
        if (x < 0 || x >= field.width) continue;
        const [r, g, b, a] = pixelAt(plate.image, px, py);
        if (a === 0) continue;
        const [dr, dg, db, da] = pixelAt(field, x, y);
        const alpha = a + Math.round((da * (255 - a)) / 255);
        if (alpha === 0) continue;
        const blend = (under: number, over: number): number =>
          Math.round((over * a + under * da * (1 - a / 255)) / alpha);
        setPixel(field, x, y, [blend(dr, r), blend(dg, g), blend(db, b), alpha]);
      }
    }
  }
  return field;
}

const FIELD_ORIGIN = { x: FOREST_EXTERIOR_APRON.x, y: FOREST_EXTERIOR_APRON.y } as const;

/** The authored ground at a scene-local pixel, or null where none was painted. */
function groundAt(field: Image, x: number, y: number): [number, number, number, number] | null {
  const px = Math.round(x - FIELD_ORIGIN.x);
  const py = Math.round(y - FIELD_ORIGIN.y);
  if (px < 0 || py < 0 || px >= field.width || py >= field.height) return null;
  const [r, g, b, a] = pixelAt(field, px, py);
  return a >= 200 ? [r, g, b, a] : null;
}

/**
 * The colour the apron continues for a point, taken from the authored ground at
 * the point's own reflection across the rim — `2 * depth` in, which is a rigid
 * mirror and therefore carries the texture in two dimensions instead of smearing
 * the rim line outward as a translation of the depth would. Inside the seam band
 * the offset is the band's own width, so that band is a plain shift.
 *
 * Where the mirror point is blocked by a pond, a ledge or a cover cell — objects
 * standing on the ground, not ground — the walk keeps going to the terrain those
 * objects stand on, and mirrors again across the hole's far edge. Taking the
 * first ground past the hole instead hands every depth whose mirror falls in it
 * the same far-edge pixel: the one-row comb the raised shelf left on the east
 * rim.
 */
export function apronTerrain(
  field: Image,
  x: number,
  y: number,
): { r: number; g: number; b: number } | null {
  const depth = apronDepth(x, y);
  const inward = apronInward(x, y);
  const mirror = depth > 0 ? 2 * depth : APRON_SEAM + 0.08;
  const sample = (t: number): [number, number, number, number] | null => {
    const point = scenePixel(x + inward.x * t, y + inward.y * t);
    return groundAt(field, point.x, point.y);
  };
  const direct = sample(mirror);
  if (direct) return { r: direct[0], g: direct[1], b: direct[2] };
  const resumed = groundEdge(sample, mirror);
  if (!resumed) return null;
  const { t: far, ground: edge } = resumed;
  const colour = { r: edge[0], g: edge[1], b: edge[2] };
  // Near a corner the mirror falls off the board or into another rim's own
  // feather, not into an object's hole; there the first ground is the nearest
  // continuation. Only the other sides decide that: along the way back in, every
  // shallow mirror sits in this rim's own feather, which is exactly where the
  // shelf's hole begins.
  if (sideDepth(x + inward.x * mirror, y + inward.y * mirror, inward) > -APRON_SEAM) return colour;
  // Reflect across the far edge, so the depths that fall in the hole read
  // ground that moves with them instead of one line of it.
  const steps = Math.floor(SAMPLE_REACH / SAMPLE_STEP);
  for (let back = 0; back <= steps; back++) {
    const found = sample(2 * far - mirror + back * SAMPLE_STEP);
    if (found) return { r: found[0], g: found[1], b: found[2] };
  }
  return colour;
}

/** How far outside the board a point is, ignoring the rim `inward` leads back through. */
function sideDepth(x: number, y: number, inward: { x: number; y: number }): number {
  const { width, height } = FOREST_APRON_MAP;
  const sides = [
    { x: 1, y: 0, depth: -x },
    { x: -1, y: 0, depth: x - width },
    { x: 0, y: 1, depth: -y },
    { x: 0, y: -1, depth: y - height },
  ];
  return Math.max(
    ...sides.filter((side) => side.x !== inward.x || side.y !== inward.y).map((s) => s.depth),
  );
}

/**
 * Where the ground resumes past a blocked sample, found once to a fraction of a
 * pixel: a coarse walk for the first ground, then bisection back to its edge.
 * Stepping from each point's own mirror instead lands every point on its own
 * multiple of the stride, and the far edge wobbles into micro-bands.
 */
function groundEdge(
  sample: (t: number) => [number, number, number, number] | null,
  from: number,
): { t: number; ground: [number, number, number, number] } | null {
  const steps = Math.floor(SAMPLE_REACH / SAMPLE_STEP);
  for (let step = 1; step <= steps; step++) {
    let t = from + step * SAMPLE_STEP;
    let ground = sample(t);
    if (!ground) continue;
    let miss = t - SAMPLE_STEP;
    for (let i = 0; i < 10; i++) {
      const mid = (miss + t) / 2;
      const found = sample(mid);
      if (found) [t, ground] = [mid, found];
      else miss = mid;
    }
    return { t, ground };
  }
  return null;
}

/**
 * `watercourse` is the creek plates alone. They run out past the south rim on
 * their own (the far bank's stones, then the plate's own fade), so any exterior
 * pixel they paint is left clear: the apron is drawn last and would otherwise
 * cover that bank and fade with a second, banked meadow.
 */
export function packApron(plates: readonly ApronPlate[], guard: Image, watercourse?: Image): Image {
  const field = baseField(plates);
  const image = newImage(FOREST_EXTERIOR_APRON.width, FOREST_EXTERIOR_APRON.height);
  for (let py = 0; py < image.height; py++) {
    for (let px = 0; px < image.width; px++) {
      const { x, y } = apronLogical(px, py);
      const depth = apronDepth(x, y);
      const inside = depth <= 0;
      // A clear pixel beside the band still carries the ground's colour at
      // alpha 0: left black, the lossy encoder smeared it across the edge into
      // a light line round the rim, as it did on Ba Dan's apron.
      const bleed = (): void => {
        const under = inside ? pixelAt(field, px, py) : null;
        const colour =
          under && (under[3] ?? 0) > 0
            ? { r: under[0] ?? 0, g: under[1] ?? 0, b: under[2] ?? 0 }
            : apronTerrain(field, x, y);
        if (colour) setPixel(image, px, py, [colour.r, colour.g, colour.b, 0]);
      };
      if (inside ? depth <= -APRON_SEAM : depth >= APRON_FADE) {
        if (depth > -APRON_SEAM - RIM_BLEED && depth < APRON_FADE + RIM_BLEED) bleed();
        continue;
      }
      if (!inside && watercourse && (pixelAt(watercourse, px, py)[3] ?? 0) > 0) {
        bleed();
        continue;
      }
      // Inside the board this plate only closes what the scene left open.
      if (inside && (pixelAt(guard, px, py)[3] ?? 0) >= GUARD_ALPHA) {
        bleed();
        continue;
      }
      const terrain = apronTerrain(field, x, y);
      if (!terrain) continue;
      // Grain and recession ramp in from the rim, so the board's own edge is
      // not redrawn as a line between the authored ground and its continuation.
      const settle = smoothstep(0, 0.35, Math.max(depth, 0));
      const grain =
        1 + settle * ((tileNoise(px, py, 7) - 0.5) * 0.09 + (tileNoise(px, py, 11) - 0.5) * 0.05);
      const recession = 1 - 0.1 * smoothstep(0.1, APRON_FADE, Math.max(depth, 0));
      const shade = (channel: number): number =>
        clamp(Math.round(channel * grain * recession), 0, 255);
      // Sixteen fine flat steps dissolve the outer tile on every material,
      // including creek water and bank pixels, before the plate boundary.
      const alpha = inside ? 255 : forestApronAlpha(depth, x, y);
      setPixel(image, px, py, [shade(terrain.r), shade(terrain.g), shade(terrain.b), alpha]);
    }
  }
  return image;
}

/** The scene's own base ground, decoded from the shipped art it registers. */
export async function loadBasePlates(): Promise<ApronPlate[]> {
  return loadPlates(BASE_PLATES);
}

/** Every ground plate the scene draws, decoded, for the overpaint guard. */
export async function loadGuardField(): Promise<Image> {
  return baseField(await loadPlates(GUARD_PLATES));
}

/**
 * Pond, creek and rubble art is packed at 2x or 3x the world pixels the scene
 * registers it into. The field is in world pixels, so such a plate is averaged
 * down (premultiplied) to the size it is drawn at; plates already drawn 1:1 pass
 * through untouched.
 */
function fitToPiece(image: Image, width: number, height: number): Image {
  const factor = Math.round(image.width / width);
  if (factor <= 1 || Math.abs(image.height / factor - height) > 1) return image;
  const out = newImage(Math.round(image.width / factor), Math.round(image.height / factor));
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      let a = 0;
      const sum = [0, 0, 0];
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const p = pixelAt(image, x * factor + dx, y * factor + dy);
          a += p[3] ?? 0;
          for (let c = 0; c < 3; c++) sum[c] = (sum[c] ?? 0) + (p[c] ?? 0) * (p[3] ?? 0);
        }
      }
      const channel = (c: number): number => (a === 0 ? 0 : Math.round((sum[c] ?? 0) / a));
      setPixel(out, x, y, [channel(0), channel(1), channel(2), Math.round(a / factor ** 2)]);
    }
  }
  return out;
}

async function loadPlates(names: readonly string[]): Promise<ApronPlate[]> {
  const plates: ApronPlate[] = [];
  const found = new Set<string>();
  // Scene order is draw order, and a repeated plate (the rubble cells) is drawn
  // once per cell, so every matching piece belongs in the field. The heap's
  // variants (`rubble-1.webp`, ...) all answer to `rubble.webp`.
  for (const piece of FOREST_ROAD_SCENE.ground) {
    const url = piece.url.replace(/rubble-\d\.webp$/, 'rubble.webp');
    const name = names.find((candidate) => url.endsWith(candidate));
    if (!name) continue;
    found.add(name);
    plates.push({
      image: fitToPiece(await readWebp(`public/${piece.url}`), piece.width, piece.height),
      x: piece.x,
      y: piece.y,
    });
  }
  for (const name of names)
    if (!found.has(name)) throw new Error(`${name} is not registered in the forest scene`);
  return plates;
}

/** The creek plates alone, composited, for the apron to leave clear. */
export async function loadWatercourseField(): Promise<Image> {
  return baseField(await loadPlates(WATERCOURSE_PLATES));
}

/** The apron plate for the scene as registered, decoded from the shipped art. */
export async function packSceneApron(): Promise<Image> {
  return packApron(await loadBasePlates(), await loadGuardField(), await loadWatercourseField());
}

async function main(): Promise<void> {
  await writeApronPlates({
    ring: await packSceneApron(),
    bands: FOREST_APRON_BANDS,
    directory: DIRECTORY,
    stem: STEM,
    quality: QUALITY,
  });
}

if (process.argv[1]?.endsWith('forest-exterior-apron.ts')) {
  await main();
}
