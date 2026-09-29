/**
 * Where the Forest Road's low reeds meet the ground, and the wear laid there.
 *
 * The pond's three reed fringes and the flood-bank nest are passable scenery
 * a fraction of their cell's size. The runtime contact shadow is keyed to the
 * whole footprint, so under them it drew a dark diamond: a placed tile, not a
 * clump growing out of the bank. They opt out of it (`contactShadow: false`)
 * and are seated here instead, as Ba Dan's garden pack seats its scenery
 * (`ba-dan-garden.ts`, `CONTACT_FEET` and `contactWear`): at the _painted_
 * foot, never the footprint's square.
 *
 * A foot is the lowest opaque pixel of each sprite column, kept only where it
 * projects onto or just round the piece's cell. The wear is damp soil in the
 * pond margin's own two tones, reaching out from those feet by an amount that
 * swells and dies away on broad ground-plane noise and leans into the south-east
 * shade, so it is a lopsided smear under the stalks with nothing about it
 * following a tile edge. `forest-route-ground.ts` paints it into the route plate.
 */
import { readFileSync } from 'node:fs';
import {
  FOREST_BANK_NEST_REEDS,
  FOREST_CREEK_REEDS,
  FOREST_POND_REEDS,
} from '../../src/content/scenes/forestRoad';
import type { SceneScenery } from '../../src/core/types';
import { tileNoise } from '../../src/render/painters/shapes';
import { parseHex, pixelAt } from './lib/image';
import type { Image } from './lib/image';
import { decodeWebp } from './lib/webp';
import { FOREST_PIECE_TONES } from './forest-village-material';

/** The pieces this seats: every forest scenery piece that opts out of the contact shadow. */
export const REED_PIECES: readonly SceneScenery[] = [
  ...FOREST_POND_REEDS,
  ...FOREST_CREEK_REEDS,
  FOREST_BANK_NEST_REEDS,
];

/** A painted foot, in scene world pixels. */
export interface ReedFoot {
  readonly x: number;
  readonly y: number;
}

/** Scene world pixels to logical ground tiles, the forest's own projection. */
export function worldLogical(wx: number, wy: number): { x: number; y: number } {
  const dx = (wx - 768) / 64,
    dy = wy / 32;
  return { x: (dx + dy) / 2, y: (dy - dx) / 2 };
}

/** How far outside its one cell a foot may project and still be a foot, in tiles. */
const FOOT_REACH = 0.2;
/** World pixels between sampled sprite columns. */
const COLUMN_STEP = 2;

/** The lowest opaque pixel of each column of every piece, where it lands on its cell. */
export const REED_FEET: readonly ReedFoot[] = await (async () => {
  const textures = new Map<string, Image>();
  const feet: ReedFoot[] = [];
  for (const piece of REED_PIECES) {
    let texture = textures.get(piece.url);
    if (!texture) {
      texture = await decodeWebp(new Uint8Array(readFileSync(`public/${piece.url}`)));
      textures.set(piece.url, texture);
    }
    const cell = piece.footprint[0];
    if (!cell) continue;
    for (let wx = piece.x + COLUMN_STEP / 2; wx < piece.x + piece.width; wx += COLUMN_STEP) {
      const column = Math.floor(((wx - piece.x) / piece.width) * texture.width);
      const sx = piece.flip ? texture.width - 1 - column : column;
      let row = -1;
      for (let sy = texture.height - 1; sy >= 0; sy--)
        if (pixelAt(texture, sx, sy)[3] > 160) {
          row = sy;
          break;
        }
      if (row < 0) continue;
      const wy = piece.y + ((row + 1) * piece.height) / texture.height;
      const at = worldLogical(wx, wy);
      const outside = Math.max(Math.abs(at.x - cell.x - 0.5), Math.abs(at.y - cell.y - 0.5)) - 0.5;
      if (outside <= FOOT_REACH) feet.push({ x: wx, y: wy });
    }
  }
  return feet;
})();

/** Farthest the wear reaches from a foot, in foreshortened world pixels. */
export const REED_WEAR_REACH = 36;

/** Each piece's feet, boxed out to the wear's reach: a cheap test before the search. */
const REED_CLUMPS = REED_PIECES.map((piece) => ({
  x0: piece.x - REED_WEAR_REACH,
  x1: piece.x + piece.width + REED_WEAR_REACH,
  y0: piece.y - REED_WEAR_REACH,
  y1: piece.y + piece.height + REED_WEAR_REACH,
}));

/** Bilinear value noise over the tile hash, in ground-plane tiles. */
function valueNoise(x: number, y: number, salt: number): number {
  const x0 = Math.floor(x),
    y0 = Math.floor(y);
  const fx = x - x0,
    fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy);
  const a = tileNoise(x0, y0, salt),
    b = tileNoise(x0 + 1, y0, salt),
    c = tileNoise(x0, y0 + 1, salt),
    d = tileNoise(x0 + 1, y0 + 1, salt);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}

/** The wear's two flat tones: the pond margin's shadow at the core, its base in chips. */
export const REED_WEAR_TONES = {
  core: FOREST_PIECE_TONES.margin.shadow,
  chip: FOREST_PIECE_TONES.margin.base,
} as const;
export const REED_WEAR_RGB = {
  core: parseHex(REED_WEAR_TONES.core),
  chip: parseHex(REED_WEAR_TONES.chip),
} as const;

/**
 * Wear at a world pixel, as one of `REED_WEAR_TONES`' keys, or null for plain
 * ground. Distance is measured on the ground plane: vertical world pixels
 * count double, undoing the projection's squash.
 */
export function reedWear(wx: number, wy: number): 'core' | 'chip' | null {
  if (!REED_CLUMPS.some((c) => wx >= c.x0 && wx <= c.x1 && wy >= c.y0 && wy <= c.y1)) return null;
  let best = Infinity,
    foot: ReedFoot | undefined;
  for (const f of REED_FEET) {
    if (Math.abs(wx - f.x) > REED_WEAR_REACH || Math.abs(wy - f.y) > REED_WEAR_REACH / 2) continue;
    const d = Math.hypot(wx - f.x, 2 * (wy - f.y));
    if (d < best) {
      best = d;
      foot = f;
    }
  }
  if (!foot || best >= REED_WEAR_REACH) return null;
  const { x, y } = worldLogical(wx, wy);
  // Swells and dies away round a clump, and leans into its south-east shade.
  const patch = valueNoise(x * 2.4, y * 2.4, 211) * 0.7 + valueNoise(x * 6.1, y * 6.1, 213) * 0.3;
  const lean = Math.max(0, wx - foot.x) / 48 + Math.max(0, wy - foot.y) / 16;
  const reach = Math.min(REED_WEAR_REACH, 6 + 22 * patch + 10 * Math.min(1, lean));
  if (best >= reach) return null;
  const chip = valueNoise(x * 9.3, y * 9.3, 217) * 0.75 + tileNoise(wx >> 1, wy >> 1, 219) * 0.25;
  if (best / reach < 0.55 && chip < 0.72) return 'core';
  return chip < 0.5 ? 'chip' : null;
}
