/**
 * Ba Dan's outer garden: one pixel-grain grass field under the whole village.
 *
 * The courts and lawns are painted pieces cut from the reviewed courtyard
 * plate, an olive meadow. Wherever they stopped, the procedural cells showed
 * through in the art bible's saturated grass (#6f9e4c), flat on Canvas and
 * fbm-noised on WebGL. So the board sat in a frame of a different green, the
 * lawns' feathered edges read as seams, and the apron carried that same bright
 * green out to the page on a smooth alpha ramp (docs/art/ba-dan-scene.md,
 * "Outer garden").
 *
 * This field is drawn in the lawns' own tones (`GARDEN_TONES`, measured from
 * the quiet-grass swatch the lawns are cut from) at one source sample per
 * world pixel on a lattice fixed to the world origin, so every piece built
 * from it agrees pixel for pixel:
 *
 * - the garden base: two opaque plates over the board, listed first in the
 *   scene's ground, so the painted courts feather into matching grass
 *   instead of into the procedural fill;
 * - the exterior apron (`ba-dan-exterior-apron.ts`), which continues it past
 *   the rim and dissolves it into the page in soft stepped bands.
 *
 * Where a road leaves the map both carry the painted flagstone instead
 * (`flagstoneTexel`), so the road runs on off the board rather than ending in
 * a strip of meadow and a patch of some other stone.
 *
 * Flat clusters of four tones and a few tufts, no gradient: the ground ink
 * rule keeps plain grass free of outline.
 *
 * npx tsx scripts/art/ba-dan-garden.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { BA_DAN_VILLAGE } from '../../src/content/maps/village';
import type { SceneScenery, Vec2 } from '../../src/core/types';
import {
  BA_DAN_APRON_MAP,
  BA_DAN_COURTYARD_GROUND,
  BA_DAN_EXTERIOR_APRON,
  BA_DAN_GARDEN_PLATES,
  BA_DAN_SCENE,
} from '../../src/content/scenes/baDan';
import { tileNoise } from '../../src/render/painters/shapes';
import { imageSize, newImage, pixelAt, readImage, setPixel } from './lib/image';
import type { Image } from './lib/image';
import { CLUMPS, treeSpecs } from './ba-dan-trees';
import { decodeWebp, encodeWebp } from './lib/webp';
import {
  GROUND_WEBP_QUALITY,
  pavingSwatchPoint,
  villageBake,
  villageGroundRgb,
  villageLawnRgb,
} from './ba-dan-village-material';

export const DIRECTORY = 'public/art/maps/ba-dan-scene';
/** World pixels per sample: one, matching the fine painted scene standard. */
export const GRAIN = 1;
/** The projection's origin, matching the scene's own pieces. */
const ORIGIN = 1024;

type Rgb = readonly [number, number, number];

/**
 * Deep, shadow, base and light: the quiet-grass swatch (courtyard cells
 * x10..11, y4) split at its 20th, 50th and 80th luma percentiles, each band's
 * median, with a deeper step for tuft roots. `ba-dan-garden.test.ts` measures
 * the swatch again and holds these to it.
 */
export const GARDEN_TONES = {
  deep: [118, 130, 70],
  shadow: [142, 153, 87],
  base: [153, 161, 90],
  light: [170, 175, 101],
} as const satisfies Record<string, Rgb>;

/**
 * The art bible's road triple. Only its shadow is used, as the damp soil at
 * an upright piece's foot (`contactWear`); the road exits are the painted
 * flagstone itself (`flagstoneTexel`). The bible's paving triple is near white
 * and read as a glitch where it carried the east road past the rim.
 */
export const MATERIAL_TONES = {
  road: { shadow: [0x8e, 0x70, 0x49], base: [0xb3, 0x90, 0x64], light: [0xc7, 0xa8, 0x7d] },
} as const satisfies Record<string, Record<'shadow' | 'base' | 'light', Rgb>>;

/** World pixel to logical map coordinates; the inverse of the projection. */
export function worldLogical(wx: number, wy: number): { x: number; y: number } {
  const dx = (wx - ORIGIN) / 64;
  const dy = wy / 32;
  return { x: (dx + dy) / 2, y: (dy - dx) / 2 };
}

/** How far outside the board a logical point is, in tiles; 0 or less on it. */
export function boardDepth(x: number, y: number): number {
  const { width, height } = BA_DAN_APRON_MAP;
  return Math.max(-x, x - width, -y, y - height);
}

/**
 * Whether any of a texel's four screen-pixel centres lies on the board. The
 * garden paints exactly these texels and the apron exactly the rest, so the
 * two meet along the rim with neither a gap nor an overlap. (Painting only
 * texels whose centre was on the board left a dotted line of page along the
 * whole rim: the texels the apron skips because they touch the board.)
 */
export function texelTouchesBoard(tx: number, ty: number): boolean {
  return [0.5, GRAIN - 0.5].some((dx) =>
    [0.5, GRAIN - 0.5].some((dy) => {
      const { x, y } = worldLogical(tx * GRAIN + dx, ty * GRAIN + dy);
      return boardDepth(x, y) <= 0;
    }),
  );
}

type Terrain = 'grass' | 'road' | 'stone';

/**
 * The rim side nearest a logical point, on or off the board: its signed depth
 * (negative inside) and the terrain of the rim cell the point lines up with.
 * `ragged` jitters that line-up by up to a sixth of a tile on a clustered
 * mask, so a road carried past the rim keeps no ruled edge.
 */
export function rimBorder(
  x: number,
  y: number,
  ragged = false,
): { terrain: Terrain; depth: number } {
  const { width, height, rows } = BA_DAN_VILLAGE;
  const jitter = ragged ? (transitionCluster(x, y, 89) - 0.5) / 3 : 0;
  const column = Math.max(0, Math.min(width - 1, Math.floor(x + jitter)));
  const row = Math.max(0, Math.min(height - 1, Math.floor(y + jitter)));
  const sides = [
    { depth: -x, cell: rows[row]?.[0] },
    { depth: x - width, cell: rows[row]?.[width - 1] },
    { depth: -y, cell: rows[0]?.[column] },
    { depth: y - height, cell: rows[height - 1]?.[column] },
  ];
  const nearest = sides.reduce((best, side) => (side.depth > best.depth ? side : best));
  const key = nearest.cell ?? ',';
  const terrain: Terrain =
    key === '=' ? 'road' : key === '.' || key === 'l' || key === 'B' ? 'stone' : 'grass';
  return { terrain, depth: nearest.depth };
}

/**
 * How far inside the rim the garden base lays an exit's flagstone. The painted
 * courts feather out over the last 0.4 tiles; under that feather the road now
 * fades into road instead of into a strip of meadow.
 */
export const EXIT_INSET = 1;

/** Whether a point is on a road exit: the rim cell it lines up with is road or paving. */
export function onExit(x: number, y: number): boolean {
  const { terrain, depth } = rimBorder(x, y, true);
  return terrain !== 'grass' && depth > -EXIT_INSET;
}

// The unlit paving authority: the shipped courtyard plate carries the light.
const COURTYARD = await decodeWebp(
  new Uint8Array(readFileSync('assets/source/ba-dan-ground-v1/courtyard-paving.webp')),
);

/** The courtyard plate's broad flagstone at a logical point of the tiled swatch. */
function swatch(sx: number, sy: number): Rgb {
  const [r, g, b] = pixelAt(
    COURTYARD,
    Math.floor(ORIGIN + (sx - sy) * 64 - BA_DAN_COURTYARD_GROUND.x),
    Math.floor((sx + sy) * 32 - BA_DAN_COURTYARD_GROUND.y),
  );
  return [r, g, b];
}

const luma = ([r, g, b]: Rgb): number => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * The flagstone's own tones, as `GARDEN_TONES` are the grass's: the swatch
 * split into eight luma bands of equal count, each band's median colour.
 * Flat tones keep the exits on the garden's grain, and keep the garden plates
 * few-coloured enough to pack as a palette.
 */
export const FLAGSTONE_TONES: readonly { readonly upTo: number; readonly tone: Rgb }[] = (() => {
  const samples: Rgb[] = [];
  for (let sy = 7.08; sy < 8.93; sy += 0.04)
    for (let sx = 5.52; sx < 10.5; sx += 0.02) samples.push(swatch(sx, sy));
  samples.sort((a, b) => luma(a) - luma(b));
  return Array.from({ length: 8 }, (_, band) => {
    const part = samples.slice(
      Math.floor((band * samples.length) / 8),
      Math.floor(((band + 1) * samples.length) / 8),
    );
    const median = (ch: number): number =>
      part.map((c) => c[ch] ?? 0).sort((a, b) => a - b)[Math.floor(part.length / 2)] ?? 0;
    return {
      upTo: band === 7 ? Infinity : luma(part[part.length - 1] ?? [0, 0, 0]),
      tone: [median(0), median(1), median(2)] as Rgb,
    };
  });
})();

/**
 * The painted flagstone at a world texel: the courtyard plate's broad
 * flagstone interior (cells x5..9, y7..8), tiled on the logical grid exactly as
 * `ba-dan-neighborhood-ground.ts` tiles it for the east gate approach, so the
 * slabs carry on across the rim instead of changing material there. Each
 * sample takes its band's tone in `FLAGSTONE_TONES`.
 */
export function flagstoneTexel(tx: number, ty: number): Rgb {
  const { x, y } = worldLogical((tx + 0.5) * GRAIN, (ty + 0.5) * GRAIN);
  const point = pavingSwatchPoint(x, y);
  const l = luma(swatch(point.x, point.y));
  return (FLAGSTONE_TONES.find((band) => l <= band.upTo) ?? FLAGSTONE_TONES[7]!).tone;
}

/** Full-resolution courtyard paving for road exits; unlike lawn it is not a 2px texel. */
export function flagstonePixel(wx: number, wy: number): Rgb {
  const { x, y } = worldLogical(wx, wy);
  const point = pavingSwatchPoint(x, y);
  return swatch(point.x, point.y);
}

/** The texel's centre in world pixels, for a world pixel inside it. */
export function texelCentre(wx: number, wy: number): { x: number; y: number } {
  return {
    x: (Math.floor(wx / GRAIN) + 0.5) * GRAIN,
    y: (Math.floor(wy / GRAIN) + 0.5) * GRAIN,
  };
}

/** Bilinear value noise over the tile hash: smooth only between lattice points, then thresholded. */
function valueNoise(x: number, y: number, salt: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const a = tileNoise(x0, y0, salt);
  const b = tileNoise(x0 + 1, y0, salt);
  const c = tileNoise(x0, y0 + 1, salt);
  const d = tileNoise(x0 + 1, y0 + 1, salt);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/**
 * A world-anchored clustered mask for material transitions. Unlike an ordered
 * dither this has no short repeating lattice: neighbouring one-pixel samples
 * tend to agree, so a sparse transition reads as small painted chips rather
 * than a screen of alternating dots.
 */
export function transitionCluster(x: number, y: number, salt: number): number {
  return valueNoise(x * 2.2, y * 2.2, salt) * 0.72 + valueNoise(x * 5.1, y * 5.1, salt + 2) * 0.28;
}

/** The grass at a world texel. */
export function grassTexel(tx: number, ty: number): Rgb {
  return villageLawnRgb((tx + 0.5) * GRAIN, (ty + 0.5) * GRAIN);
}

/** Chebyshev distance in tiles from a logical point to a set of cells; negative inside. */
export function footprintDistance(x: number, y: number, cells: readonly Vec2[]): number {
  return Math.min(
    ...cells.map((cell) => Math.max(Math.abs(x - cell.x - 0.5), Math.abs(y - cell.y - 0.5)) - 0.5),
  );
}

/** A point where a piece meets the ground, and which scenery piece it belongs to. */
type Foot = {
  readonly x: number;
  readonly y: number;
  readonly tree: boolean;
  readonly piece: string;
};

/**
 * Where each upright piece really meets the ground: for every texel column of
 * its sprite, the lowest opaque pixel, kept only when that pixel projects to
 * within a third of a tile of the piece's footprint. A tree's canopy hangs
 * well clear of the ground and projects far from its cell, so only the trunk
 * and roots survive; a house keeps its plinth line; a planter its base course.
 * Wear laid from these points follows the painted silhouette, never the
 * logical footprint's square (docs/art-bible.md, "construction seams").
 */
export const CONTACT_FEET: readonly Foot[] = await (async () => {
  const textures = new Map<string, Image>();
  const feet: Foot[] = [];
  const load = async (url: string): Promise<Image> => {
    let texture = textures.get(url);
    if (!texture) {
      const path = `public/${url}`;
      const bytes = new Uint8Array(readFileSync(path));
      texture = imageSize(bytes)?.format === 'webp' ? await decodeWebp(bytes) : readImage(path);
      textures.set(url, texture);
    }
    return texture;
  };
  const specs = treeSpecs();
  for (const scenery of BA_DAN_SCENE.scenery) {
    // Exterior surround pieces never touch playable ground and may be PNGs.
    if (scenery.exterior) continue;
    const tree = scenery.id.startsWith('tree-');
    // A clump is one sprite, but the feet are its trees' own: the lowest pixel of a column of the
    // composite is as often the hanging leaves of a tree in front as any root, and a leaf tip that
    // projected near a member's cell wore a bare disc into the lawn beside it.
    const clump = /^tree-c(\d+)$/.exec(scenery.id);
    const parts: {
      piece: SceneScenery;
      texture: Image;
      rect: { x: number; y: number; width: number; height: number };
    }[] = [];
    if (clump) {
      for (const id of CLUMPS[Number(clump[1])]?.members ?? []) {
        const spec = specs.find((t) => t.id === id);
        if (!spec) continue;
        const texture = readImage(`art/source/ba-dan-restyle/fine/${spec.master}-village-tree.png`);
        parts.push({
          piece: {
            id: scenery.id,
            url: '',
            x: spec.x,
            y: spec.y,
            width: spec.width,
            height: spec.height,
            // Where the tree is drawn, not the cell it blocks: a crown moved off its cells still
            // stands on its own roots.
            footprint: [{ x: Math.floor(spec.depth.x), y: Math.floor(spec.depth.y) }],
            depth: spec.depth,
            ...(spec.flip ? { flip: true } : {}),
          },
          texture,
          rect: { x: 0, y: 0, width: texture.width, height: texture.height },
        });
      }
    } else {
      const texture = await load(scenery.url);
      parts.push({
        piece: scenery,
        texture,
        rect: scenery.sourceRect ?? { x: 0, y: 0, width: texture.width, height: texture.height },
      });
    }
    for (const { piece, texture, rect } of parts) {
      const first = Math.ceil(piece.x / GRAIN);
      for (let tx = first; (tx + 0.5) * GRAIN < piece.x + piece.width; tx++) {
        const u = ((tx + 0.5) * GRAIN - piece.x) / piece.width;
        const column = Math.floor(u * rect.width);
        const sx = rect.x + (piece.flip ? rect.width - 1 - column : column);
        let row = -1;
        for (let sy = rect.y + rect.height - 1; sy >= rect.y; sy--)
          if (pixelAt(texture, sx, sy)[3] > 128) {
            row = sy;
            break;
          }
        if (row < 0) continue;
        const wx = (tx + 0.5) * GRAIN;
        const wy = piece.y + ((row - rect.y + 1) * piece.height) / rect.height;
        const at = worldLogical(wx, wy);
        if (footprintDistance(at.x, at.y, piece.footprint) <= 0.35)
          feet.push({ x: wx, y: wy, tree, piece: scenery.id });
      }
    }
  }
  return feet;
})();

/** Farthest reach of contact wear from a foot, in foreshortened world pixels. */
const WEAR_REACH = 44;

/**
 * The nearest foot to every world texel within `WEAR_REACH`, measured on the
 * ground plane (vertical world pixels count double, undoing the projection's
 * squash), stamped once so the plates need not search the feet per texel.
 */
const WEAR_FIELD = (() => {
  const x0 = Math.floor(BA_DAN_EXTERIOR_APRON.x / GRAIN);
  const y0 = Math.floor(BA_DAN_EXTERIOR_APRON.y / GRAIN);
  const width = Math.ceil(BA_DAN_EXTERIOR_APRON.width / GRAIN) + 1;
  const height = Math.ceil(BA_DAN_EXTERIOR_APRON.height / GRAIN) + 1;
  const distance = new Float32Array(width * height).fill(Infinity);
  const foot = new Int32Array(width * height).fill(-1);
  const reachX = Math.ceil(WEAR_REACH / GRAIN);
  const reachY = Math.ceil(WEAR_REACH / 2 / GRAIN);
  CONTACT_FEET.forEach((f, index) => {
    const fx = Math.floor(f.x / GRAIN);
    const fy = Math.floor(f.y / GRAIN);
    for (let ty = fy - reachY; ty <= fy + reachY; ty++)
      for (let tx = fx - reachX; tx <= fx + reachX; tx++) {
        const i = (ty - y0) * width + (tx - x0);
        if (tx < x0 || ty < y0 || tx - x0 >= width || ty - y0 >= height) continue;
        const d = Math.hypot((tx + 0.5) * GRAIN - f.x, 2 * ((ty + 0.5) * GRAIN - f.y));
        if (d < (distance[i] ?? Infinity)) {
          distance[i] = d;
          foot[i] = index;
        }
      }
  });
  return (tx: number, ty: number): { distance: number; foot: Foot } | null => {
    if (tx < x0 || ty < y0 || tx - x0 >= width || ty - y0 >= height) return null;
    const i = (ty - y0) * width + (tx - x0);
    const f = CONTACT_FEET[foot[i] ?? -1];
    return f ? { distance: distance[i] ?? Infinity, foot: f } : null;
  };
})();

/** The scenery piece whose foot is nearest a world texel within wear reach, if any. */
export function wearOwner(tx: number, ty: number): string | null {
  return WEAR_FIELD(tx, ty)?.foot.piece ?? null;
}

/**
 * Contact wear at a world texel: damp soil and leaf litter at the foot of an
 * upright piece, or null for plain ground.
 *
 * The reach is set by broad value noise on the ground plane, so it swells and
 * dies away along a plinth and around a trunk: patches of trodden earth at
 * some stretches of a house's base course and none at others, and under a
 * tree a lopsided spill of roots and litter that leans into its shade, the
 * south-east. Nothing about it follows a tile edge. The tones are the
 * garden's deep grass and the road's shadow, flat, in clusters.
 */
export function contactWear(tx: number, ty: number): Rgb | null {
  const near = WEAR_FIELD(tx, ty);
  if (!near) return null;
  const { distance, foot } = near;
  const wx = (tx + 0.5) * GRAIN;
  const wy = (ty + 0.5) * GRAIN;
  const { x, y } = worldLogical(wx, wy);
  const patch = valueNoise(x * 1.4, y * 1.4, foot.tree ? 101 : 103);
  // Broad and lopsided for a tree, a narrow and broken skirt for a plinth.
  const lean = foot.tree ? Math.max(0, wx - foot.x) / 64 + Math.max(0, wy - foot.y) / 24 : 0;
  const reach = foot.tree
    ? 8 + 26 * patch + 10 * Math.min(1, lean)
    : Math.max(0, (16 * (patch - 0.35)) / 0.65);
  if (distance >= Math.min(WEAR_REACH, reach)) return null;
  const inner = distance / reach;
  const chip = transitionCluster(x, y, foot.tree ? 105 : 107);
  if (inner < 0.55 && chip < 0.7) return MATERIAL_TONES.road.shadow;
  if (chip < (foot.tree ? 0.55 : 0.4)) return GARDEN_TONES.deep;
  return null;
}

/** What the garden base paints at a world texel on the board. */
export function gardenTexel(tx: number, ty: number): Rgb {
  const wx = (tx + 0.5) * GRAIN;
  const wy = (ty + 0.5) * GRAIN;
  const at = worldLogical(wx, wy);
  return onExit(at.x, at.y) ? flagstoneTexel(tx, ty) : villageGroundRgb(wx, wy);
}

/**
 * One opaque plate of the garden base: every texel that touches the board is
 * grass, or flagstone on a road exit's last tile; everything else is clear,
 * for the apron to continue.
 */
export function packGardenPlate(plate: {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}): Image {
  if (plate.x % GRAIN || plate.y % GRAIN)
    throw new Error('A plate must start on the texel lattice.');
  const image = newImage(plate.width, plate.height);
  for (let py = 0; py < plate.height; py++) {
    for (let px = 0; px < plate.width; px++) {
      const tx = Math.floor((plate.x + px) / GRAIN);
      const ty = Math.floor((plate.y + py) / GRAIN);
      if (!texelTouchesBoard(tx, ty)) continue;
      const wx = plate.x + px + 0.5;
      const wy = plate.y + py + 0.5;
      const at = worldLogical(wx, wy);
      const colour = onExit(at.x, at.y) ? flagstonePixel(wx, wy) : gardenTexel(tx, ty);
      setPixel(image, px, py, [...villageBake(wx, wy, colour), 255]);
    }
  }
  return image;
}

export function gardenPlatePath(index: number): string {
  return `${DIRECTORY}/garden-${index}.webp`;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/art/ba-dan-garden.ts')) {
  mkdirSync(DIRECTORY, { recursive: true });
  for (const [index, plate] of BA_DAN_GARDEN_PLATES.entries()) {
    writeFileSync(
      gardenPlatePath(index),
      await encodeWebp(packGardenPlate(plate), GROUND_WEBP_QUALITY, true),
    );
    console.log(gardenPlatePath(index));
  }
}
