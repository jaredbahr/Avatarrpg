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
 * stretch of a longer road, and the reference reads that way. Nothing here
 * touches a playable pixel; every sample inside the board stays transparent,
 * which `forest-exterior-apron.test.ts` asserts.
 *
 * npx tsx scripts/art/forest-exterior-apron.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import decode, { init as initWebpDecode } from '@jsquash/webp/decode.js';
import {
  FOREST_APRON_MAP,
  FOREST_EXTERIOR_APRON,
  FOREST_ROAD_SCENE,
} from '../../src/content/scenes/forestRoad';
import { tileNoise } from '../../src/render/painters/shapes';
import { newImage, pixelAt, setPixel } from './lib/image';
import type { Image } from './lib/image';
import { encodeWebp } from './lib/webp';

export const OUTPUT = 'public/art/maps/forest-scene/exterior-apron.webp';
/** Authored terrain is fully faded out by this far outside the rim, in tiles. */
export const APRON_FADE = 2.2;
/**
 * How far inside the rim the plate may reach to close the authored ground's own
 * feather. The grass packs fade to alpha 0 across their outermost ~0.2 tiles; on
 * the page that was invisible, and beside textured ground it reads as a pale
 * hem. The plate fills that band, but only where the scene's own ground leaves
 * the page showing (`GUARD_ALPHA`), so it never overpaints authored ground.
 */
export const APRON_SEAM = 0.35;
/** Ground this opaque is the scene's own painting and is left alone. */
export const GUARD_ALPHA = 250;
/**
 * How far inside the board the continuation may reach to find real ground. Two
 * tiles of ledge stand on the eastern rim's cells, so the walk has to be able
 * to cross them to the grass bank they are cut into.
 */
const SAMPLE_REACH = 3.4;
/** Tile centre of logical (0,0) in scene-local pixels, as every piece uses it. */
const ORIGIN = { x: 768, y: 0 } as const;
const TILE = { width: 64, height: 32 } as const;
/**
 * The plates whose pixels the apron continues, in the scene's own draw order.
 * The pond, the raised shelf and the rubble keep their authored edges: they are
 * objects standing on the ground, not ground to be smeared outward.
 */
const BASE_PLATES = ['grass-north.webp', 'grass-south.webp', 'route-ground.webp'] as const;
/** Every ground plate, in draw order, for the overpaint guard. */
const GUARD_PLATES = [
  'grass-north.webp',
  'grass-south.webp',
  'route-ground.webp',
  'pond-bank.webp',
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
 * standing on the ground, not ground — the walk keeps going until it finds the
 * terrain those objects stand on.
 */
export function apronTerrain(
  field: Image,
  x: number,
  y: number,
): { r: number; g: number; b: number } | null {
  const depth = apronDepth(x, y);
  const inward = apronInward(x, y);
  const mirror = depth > 0 ? 2 * depth : APRON_SEAM + 0.08;
  for (let t = mirror; t <= mirror + SAMPLE_REACH; t += 0.08) {
    const point = scenePixel(x + inward.x * t, y + inward.y * t);
    const found = groundAt(field, point.x, point.y);
    if (found) return { r: found[0], g: found[1], b: found[2] };
  }
  return null;
}

export function packApron(plates: readonly ApronPlate[], guard: Image): Image {
  const field = baseField(plates);
  const image = newImage(FOREST_EXTERIOR_APRON.width, FOREST_EXTERIOR_APRON.height);
  for (let py = 0; py < image.height; py++) {
    for (let px = 0; px < image.width; px++) {
      const { x, y } = apronLogical(px, py);
      const depth = apronDepth(x, y);
      const inside = depth <= 0;
      if (inside ? depth <= -APRON_SEAM : depth >= APRON_FADE) continue;
      // Inside the board this plate only closes what the scene left open.
      if (inside && (pixelAt(guard, px, py)[3] ?? 0) >= GUARD_ALPHA) continue;
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
      const alpha = inside ? 255 : Math.round(255 * (1 - smoothstep(0.05, APRON_FADE, depth)));
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

async function loadPlates(names: readonly string[]): Promise<ApronPlate[]> {
  const plates: ApronPlate[] = [];
  const found = new Set<string>();
  // Scene order is draw order, and a repeated plate (the rubble cells) is drawn
  // once per cell, so every matching piece belongs in the field.
  for (const piece of FOREST_ROAD_SCENE.ground) {
    const name = names.find((candidate) => piece.url.endsWith(candidate));
    if (!name) continue;
    found.add(name);
    plates.push({ image: await readWebp(`public/${piece.url}`), x: piece.x, y: piece.y });
  }
  for (const name of names)
    if (!found.has(name)) throw new Error(`${name} is not registered in the forest scene`);
  return plates;
}

/** The apron plate for the scene as registered, decoded from the shipped art. */
export async function packSceneApron(): Promise<Image> {
  return packApron(await loadBasePlates(), await loadGuardField());
}

async function main(): Promise<void> {
  mkdirSync('public/art/maps/forest-scene', { recursive: true });
  writeFileSync(OUTPUT, await encodeWebp(await packSceneApron(), 86, true));
}

if (process.argv[1]?.endsWith('forest-exterior-apron.ts')) {
  await main();
}
