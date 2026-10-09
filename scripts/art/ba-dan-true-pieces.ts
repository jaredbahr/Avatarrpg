/**
 * Packer for the true-geometry painted Ba Dan pieces. Each `art/source/ba-dan-true/<name>.png`
 * is the painted master after the edge pass (`scripts/art/ba-dan-guides/edge.py`: the guide
 * geometry gives the antialiased alpha and the outline), at the guide's canvas size; the
 * packer shades the houses' horizontal faces from the shared light, fringes lawn-standing
 * stone feet with grass, and encodes under a `true-` name. Forest Road's lodge borrows the
 * older `dwelling.webp`, packed by `ba-dan-restyle.ts`. The bridge's near-bank layer is cut
 * along the tile line y = 6.5 + 0.5 (local v = 2), a constant `y - x/2` line in the canvas.
 * `art/source/ba-dan-true/README.md` gives the whole order from painted master to shipped file.
 *
 * Usage: node --import tsx scripts/art/ba-dan-true-pieces.ts [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { composeAtlas, shelfPack } from './lib/atlas';
import type { Placed } from './lib/atlas';
import { BA_DAN_VILLAGE } from '../../src/content/maps/village';
import { BA_DAN_SCENE, BA_DAN_TRUE_PIECES } from '../../src/content/scenes/baDan';
import {
  SHADOW_MULTIPLY,
  VILLAGE_VOLUMES,
  logicalToWorld,
  openLightAt,
  shadowOnPlane,
  worldToLogical,
} from './ba-dan-village-light';
import { landingSeat, troddenAt, villageLawnRgb } from './ba-dan-village-material';
import { newImage, readImage } from './lib/image';
import type { Image } from './lib/image';
import { LOSSY_MAX_RGB, LOSSY_MEAN_RGB, lossyError } from './lib/lossy-compare';
import { UPRIGHT_WEBP_OPTIONS, UPRIGHT_WEBP_QUALITY, decodeWebp, encodeWebp } from './lib/webp';

const SOURCE = 'art/source/ba-dan-true';
const OUTPUT = 'public/art/maps/ba-dan-scene';
export const TRUE_PIECES = [
  'dwelling-4x3',
  'merchant-house-4x3',
  'dwelling-4x4',
  'merchant-house-4x4',
  'merchant-display',
  'merchant-display-b',
  'merchant-display-c',
  'low-planter',
  'low-planter-1x2',
  'canal-bridge',
] as const;
/**
 * `y - x / 2` in bridge canvas pixels of the tile line the deck is split on (v = 2).
 * Measured on the v3 guide (1.5 px per world px): (0,2) of the footprint is at (111, 125).
 */
/** The set dressing and the terrace planter: each is one edge-treated master, packed into `true-dressing.webp`. */
export const DRESSING_PIECES = [
  'village-well',
  'banner-pole',
  'lantern-post',
  'shop-stack',
  'baskets',
  'laundry-line',
  'notice-board',
  'handcart',
  'bench-2x1',
  'garden-plot-3x2',
  'stone-lantern',
  'trough-hay',
  'fence-2x1',
  'terrace-planter-2x1',
] as const;
/**
 * The boundary wall is two composed runs (`ba-dan-guides/walls.py`, at 1.5 pixels per world pixel like
 * every other true piece, `art/source/ba-dan-true/walls/`), drawn as vertical strips of them at 2/3: a
 * sprite is a rectangle and a run is a diagonal band, so each strip is the band between two world x
 * values (an even number of world px from the run's origin, so a whole number of source px), trimmed to
 * its paint on rows of three source px (two world px).
 */
export const WALL_STRIPS: readonly { run: 'north-west' | 'west-south'; x0: number; x1: number }[] =
  [
    { run: 'north-west', x0: 536, x1: 800 },
    { run: 'north-west', x0: 800, x1: 1060 },
    { run: 'north-west', x0: 1060, x1: 1594 },
    { run: 'north-west', x0: 1594, x1: 2128 },
    { run: 'north-west', x0: 2128, x1: 2664 },
    { run: 'west-south', x0: -104, x1: 390 },
  ];
export const DRESSING_ATLAS_WIDTH = 2048;
export const WALL_ATLAS_WIDTH = 2048;
/** The strips in the order the wall atlas lays them: two rows of three, each as wide as the atlas allows. */
export const WALL_ATLAS_ORDER = [2, 3, 1, 4, 5, 0] as const;
export const TRUE_BRIDGE_CUT = 69.5;

/**
 * The upright encode (q90 stepping up to the fine-grain contract) with `exact`, so the colour
 * bled under the transparent fringe survives instead of being cleaned to flat: the pieces'
 * edge is an antialiased alpha over the outline colour (`ba-dan-guides/edge.py`), and
 * whatever filters it, bilinear or premultiplied, must find that colour there. The alpha
 * plane is lossless; this throws unless every alpha is exact and the fringe stays outline brown.
 */
export async function encodeTruePiece(image: Image): Promise<Uint8Array> {
  for (let quality = UPRIGHT_WEBP_QUALITY; quality <= 100; quality++) {
    const bytes = await encodeWebp(image, quality, true, { ...UPRIGHT_WEBP_OPTIONS, exact: 1 });
    const decoded = await decodeWebp(bytes);
    const error = lossyError(image, decoded);
    if (error.alphaMismatches > 0) throw new Error('true piece: the alpha plane moved');
    if (error.maxRgb > LOSSY_MAX_RGB || error.meanRgb >= LOSSY_MEAN_RGB) continue;
    // Under the fringe: a transparent pixel beside the shape keeps its source colour (within chroma error).
    let worst = 0;
    for (let i = 0; i < image.data.length; i += 4)
      if (image.data[i + 3] === 0 && (image.data[i] || image.data[i + 1] || image.data[i + 2]))
        for (let c = 0; c < 3; c++)
          worst = Math.max(worst, Math.abs((image.data[i + c] ?? 0) - (decoded.data[i + c] ?? 0)));
    if (worst <= 40) return bytes;
  }
  throw new Error('true piece: no quality keeps the fringe colour and the fine-grain contract');
}

/** The scenery piece each house sprite stands for. */
const HOUSE_OF: Readonly<Record<string, string>> = {
  'dwelling-4x3': 'north-house',
  'merchant-house-4x3': 'gao-house',
  'dwelling-4x4': 'southwest-house',
  'merchant-house-4x4': 'southeast-house',
};
/** Output pixels per world pixel of the guides (`pieces.py` WORLD_SCALE). */
const GUIDE_SCALE = 1.5;

/**
 * Carry each house's roof and wall shadow across its horizontal faces: the plinth top, the
 * porch ledge, the steps, the counter. The painting lights them all as open sky (a top face
 * is the brightest thing on it), but the baked ground shadow starts at the plinth's edge:
 * the roof's shadow lands past x1 at ground level, and on the porch, a plinth's height
 * closer to the eave, it is wider still. `art/source/ba-dan-true/planes/<piece>.png`
 * (`ba-dan-guides/planes.py`) says which axis-aligned plane the guide drew under each
 * pixel; here the screen projection is inverted on a horizontal one to find the 3D point and
 * the shared light (`shadowOnPlane`, the same volumes and penumbra as the ground) says how
 * much of it is in shade. Walls and risers keep the painter's own shading; terrace tops
 * face away from the shadow and stay lit.
 */
export function shadeHouse(name: string, image: Image, planes: Image): Image {
  const id = HOUSE_OF[name];
  const piece = BA_DAN_SCENE.scenery.find((p) => p.id === id);
  const spec = BA_DAN_TRUE_PIECES[name as keyof typeof BA_DAN_TRUE_PIECES];
  if (!id || !piece || !spec) return image;
  const [w, d] = spec.footprint;
  const x0 = Math.min(...piece.footprint.map((c) => c.x));
  const y0 = Math.min(...piece.footprint.map((c) => c.y));
  // `anchor` is at the drawn (2/3) size; the planes are in source pixels.
  const scale = spec.width / image.width;
  const ox = spec.anchor[0] / scale;
  const oy = spec.anchor[1] / scale;
  const volumes = VILLAGE_VOLUMES.filter((v) => v.id === `${id}-wall` || v.id === `${id}-roof`);
  const out = newImage(image.width, image.height);
  out.data.set(image.data);
  for (let py = 0; py < image.height; py++)
    for (let px = 0; px < image.width; px++) {
      const i = (py * image.width + px) * 4;
      if (planes.data[i] !== 1 || (image.data[i + 3] ?? 0) === 0) continue;
      const z = (((planes.data[i + 1] ?? 0) << 8) | (planes.data[i + 2] ?? 0)) / 100;
      const a = (px + 0.5 - ox) / (GUIDE_SCALE * 64) + (w - d);
      const b = ((py + 0.5 - oy) / GUIDE_SCALE + z) / 32 + (w + d);
      const ground = logicalToWorld(x0 + (a + b) / 2, y0 + (b - a) / 2);
      const cover = shadowOnPlane(volumes, ground.x, ground.y, z);
      if (cover <= 0) continue;
      for (let c = 0; c < 3; c++)
        out.data[i + c] = Math.round(
          (image.data[i + c] ?? 0) * (1 - cover * (1 - (SHADOW_MULTIPLY[c] ?? 1))),
        );
    }
  return out;
}

/** The pieces whose stone foot is drawn into the ground; a table's open legs and the bridge are not. */
const FRINGED = new Set([
  'terrace-planter-2x1',
  'dwelling-4x3',
  'merchant-house-4x3',
  'dwelling-4x4',
  'merchant-house-4x4',
  'low-planter',
  'low-planter-1x2',
]);
const hash1 = (x: number, salt: number): number => {
  let h = Math.imul(x + 1013, 0x9e3779b1) ^ Math.imul(salt + 7, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};
/** Smooth 1-D value noise in x. */
const noise1 = (x: number, salt: number): number => {
  const i = Math.floor(x);
  const f = x - i;
  const t = f * f * (3 - 2 * f);
  return hash1(i, salt) * (1 - t) + hash1(i + 1, salt) * t;
};

/** Every placement of a true piece in the scene: its top-left in world pixels and drawn width. */
function placementsOf(name: string): { x: number; y: number; width: number; height: number }[] {
  return BA_DAN_SCENE.scenery.filter((p) => p.url.endsWith(`/true-${name}.webp`));
}

/** Whether the ground at a world pixel is open lawn: not paving, trodden earth, a landing, water. */
function lawnAt(wx: number, wy: number): boolean {
  const p = worldToLogical(wx, wy);
  const ch =
    p.y < 0 || p.x < 0 ? 'T' : (BA_DAN_VILLAGE.rows[Math.floor(p.y)]?.[Math.floor(p.x)] ?? ',');
  if (ch !== ',' && ch !== 'T') return false;
  return landingSeat(wx, wy) === 0 && !troddenAt(p.x, p.y, wx, wy);
}

/**
 * What plants a wall in turf: a ragged fringe of grass blades and small tufts over the lowest
 * two to five pixels of a stone foot. Ground plates draw under scenery, so a fringe can only
 * live in the piece itself, and only where every placement of the piece stands on lawn: a
 * column whose foot rests on paving, a landing or a trodden trail anywhere gets none (the
 * ground's own soil band and joint moss do that job there). The foot is the lower envelope of the
 * silhouette, so it follows both ground edges; a cluster noise gates which columns carry
 * blades and each blade has its own height, so the line never reads as a comb. The
 * grass is the lawn's own colour in the light the first placement's foot is in.
 */
export function fringeFoot(
  name: string,
  image: Image,
  spots: readonly { x: number; y: number; width: number; height: number }[] = placementsOf(name),
): { image: Image; bare: number; fringed: number } {
  const out = newImage(image.width, image.height);
  out.data.set(image.data);
  if (!FRINGED.has(name) || spots.length === 0) return { image: out, bare: 0, fringed: 0 };
  const salt = 400 + [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  let bare = 0;
  let fringed = 0;
  for (let px = 0; px < image.width; px++) {
    let bottom = -1;
    for (let py = image.height - 1; py >= 0; py--)
      if ((image.data[(py * image.width + px) * 4 + 3] ?? 0) >= 128) {
        bottom = py;
        break;
      }
    if (bottom < 0) continue;
    // Which columns carry blades: clusters a few columns wide, with single blades between.
    const cluster = noise1(px / 6.5, salt);
    const lone = hash1(px, salt + 1) > 0.8;
    if (cluster < 0.3 && !lone) continue;
    const onLawn = spots.every((s) => {
      const sx = s.width / image.width;
      const sy = s.height / image.height;
      return lawnAt(s.x + (px + 0.5) * sx, s.y + (bottom + 0.5) * sy + 4);
    });
    if (!onLawn) {
      bare++;
      continue;
    }
    fringed++;
    const first = spots[0]!;
    const fx = first.width / image.width;
    const fy = first.height / image.height;
    const wx = first.x + (px + 0.5) * fx;
    const wy = first.y + (bottom + 0.5) * fy + 3;
    const light = openLightAt(wx, wy);
    const height = lone
      ? 2
      : Math.max(
          2,
          Math.min(
            5,
            Math.round(
              2.3 + 3.2 * (0.55 * noise1(px / 2.2, salt + 2) + 0.45 * hash1(px, salt + 3)),
            ),
          ),
        );
    for (let t = -1; t < height; t++) {
      const py = bottom - t;
      const i = (py * image.width + px) * 4;
      if (py < 0 || (t >= 0 && (image.data[i + 3] ?? 0) === 0)) continue;
      if (t < 0 && (image.data[i + 3] ?? 0) === 0) continue;
      // The pixel just below the foot line is outline fringe; grass covers it where a blade stands.
      const lawn = villageLawnRgb(wx + hash1(px, salt + 4) * 6, wy + 2 + t);
      // Blade bases are darker and tips lighter; a few dark gaps.
      const tip = t === height - 1 ? 22 : t === height - 2 ? 8 : 0;
      const base = t <= 0 ? -10 : 0;
      const gap = hash1(px * 7 + t, salt + 5) < 0.12 ? -22 : 0;
      for (let c = 0; c < 3; c++) {
        const v = (lawn[c] ?? 0) * (light[c] ?? 1) + (tip + base + gap) * (c === 2 ? 0.45 : 1);
        out.data[i + c] = Math.max(0, Math.min(255, Math.round(v)));
      }
    }
  }
  return { image: out, bare, fringed };
}

export function trueBridgeFront(bridge: Image): Image {
  const front = newImage(bridge.width, bridge.height);
  for (let y = 0; y < bridge.height; y++)
    for (let x = 0; x < bridge.width; x++) {
      if (y + 0.5 - 0.5 * (x + 0.5) < TRUE_BRIDGE_CUT) continue;
      const i = (y * bridge.width + x) * 4;
      front.data.set(bridge.data.subarray(i, i + 4), i);
    }
  return front;
}

/** One wall strip: the part of a composed run between two world x values, cut to the paint in it. x, y, in world px. */
export function wallStrip(strip: (typeof WALL_STRIPS)[number]): {
  image: Image;
  x: number;
  y: number;
} {
  const run = readImage(`${SOURCE}/walls/${strip.run}.png`);
  const meta = JSON.parse(readFileSync(`${SOURCE}/walls/walls.json`, 'utf8')) as Record<
    string,
    { origin: [number, number] }
  >;
  const [ox, oy] = meta[strip.run]!.origin;
  const c0 = Math.max(0, (strip.x0 - ox) * GUIDE_SCALE);
  const c1 = Math.min(run.width, (strip.x1 - ox) * GUIDE_SCALE);
  let top = run.height;
  let bottom = -1;
  for (let y = 0; y < run.height; y++)
    for (let x = c0; x < c1; x++)
      if ((run.data[(y * run.width + x) * 4 + 3] ?? 0) > 0) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  top -= top % 3;
  bottom = Math.min(run.height, Math.ceil((bottom + 1) / 3) * 3) - 1;
  const image = newImage(c1 - c0, bottom + 1 - top);
  for (let y = top; y <= bottom; y++)
    image.data.set(
      run.data.subarray((y * run.width + c0) * 4, (y * run.width + c1) * 4),
      (y - top) * image.width * 4,
    );
  return { image, x: ox + c0 / GUIDE_SCALE, y: oy + top / GUIDE_SCALE };
}

/** The sprites of `true-dressing.webp`, in the order the atlas names them. */
export function dressingItems(): { name: string; image: Image }[] {
  const terrace = BA_DAN_SCENE.scenery.filter((p) => p.id.startsWith('north-terrace-'));
  return DRESSING_PIECES.map((name) => {
    const master = readImage(`${SOURCE}/${name}.png`);
    const image = name === 'terrace-planter-2x1' ? fringeFoot(name, master, terrace).image : master;
    return { name, image };
  });
}

/** The sprites of `true-walls.webp`: the wall strips, in the order the atlas lays them. */
export function wallItems(): { name: string; image: Image }[] {
  return WALL_ATLAS_ORDER.map((i) => ({
    name: `wall-${i}`,
    image: wallStrip(WALL_STRIPS[i]!).image,
  }));
}

export async function packDressingAtlas(): Promise<{
  bytes: Uint8Array;
  placed: Placed[];
  height: number;
}> {
  const items = dressingItems();
  const { placed, height } = shelfPack(items, DRESSING_ATLAS_WIDTH);
  const image = composeAtlas(items, placed, DRESSING_ATLAS_WIDTH, height);
  return { bytes: await encodeTruePiece(image), placed, height };
}

/** The wall strips in their own atlas: each is 1.5 source px per world px, so together they are most of the village's art. */
export async function packWallAtlas(): Promise<{
  bytes: Uint8Array;
  placed: Placed[];
  height: number;
}> {
  const items = wallItems();
  const { placed, height } = shelfPack(items, WALL_ATLAS_WIDTH, 2, false);
  const image = composeAtlas(items, placed, WALL_ATLAS_WIDTH, height);
  return { bytes: await encodeTruePiece(image), placed, height };
}

/** Every file the packer writes, as the bytes that ship, in `TRUE_PIECES` order. */
export async function packTrueOutputs(): Promise<
  { file: string; bytes: Uint8Array; fringed?: { fringed: number; bare: number } }[]
> {
  const out: Awaited<ReturnType<typeof packTrueOutputs>> = [];
  for (const name of TRUE_PIECES) {
    const painted = readImage(`${SOURCE}/${name}.png`);
    const shaded = HOUSE_OF[name]
      ? shadeHouse(name, painted, readImage(`${SOURCE}/planes/${name}.png`))
      : painted;
    const { image, bare, fringed } = fringeFoot(name, shaded);
    out.push({
      file: `true-${name}.webp`,
      bytes: await encodeTruePiece(image),
      ...(FRINGED.has(name) ? { fringed: { fringed, bare } } : {}),
    });
    if (name === 'canal-bridge')
      out.push({
        file: `true-${name}-front.webp`,
        bytes: await encodeTruePiece(trueBridgeFront(image)),
      });
  }
  out.push({ file: 'true-dressing.webp', bytes: (await packDressingAtlas()).bytes });
  out.push({ file: 'true-walls.webp', bytes: (await packWallAtlas()).bytes });
  return out;
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  let failed = false;
  for (const { file, bytes, fringed } of await packTrueOutputs()) {
    if (check) {
      const same = Buffer.from(readFileSync(`${OUTPUT}/${file}`)).equals(Buffer.from(bytes));
      console.log(`${file}: ${same ? 'matches' : 'DIFFERS'}`);
      if (!same) failed = true;
    } else {
      writeFileSync(`${OUTPUT}/${file}`, bytes);
      console.log(JSON.stringify({ file, bytes: bytes.length, ...fringed }));
    }
  }
  if (failed) process.exit(1);
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('scripts/art/ba-dan-true-pieces.ts'))
  await main();
