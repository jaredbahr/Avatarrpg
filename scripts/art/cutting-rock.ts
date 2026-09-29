/**
 * The Cutting's raised ground (M5, plan 1.5): its `X` rock and its tier-1 `^`
 * ledges, painted into the stone page the way `quarry-rock.ts` stands the
 * gate's and the Driller's rock — each surface lifted by its height, and a
 * pixel whose lifted top would already be off the surface is the block face
 * instead, so every face stands straight up from a down-screen (+x/+y) edge
 * inside the rules' own cells and never paints over a playable one.
 *
 * It is its own painter, not the shared one, for three reasons the round-2
 * review gave (M5 A3):
 *
 * - **The back edge is sheer and tall.** The north cut (rows 0 to
 *   `CUTTING_NORTH_FACE_LAST_ROW`) stands `NORTH_RISE`, four courses over the
 *   road and three over a ledge, where the shared painter caps every face at
 *   two. The south run keeps the shared heights — two courses over the bays,
 *   one over a ledge, and a one-course lip at the board's edge — so nothing
 *   tall stands between the camera and the southern bays. All of it is ground
 *   page under the units, so a tall face can never hide one.
 * - **Rock and ledge read apart.** A ledge is walkable, so it keeps the dressed
 *   `block` paving and gains a one-course face of its own. The rock is not, so
 *   its top is rough: the `block` tones laid over the spoil row's chipped
 *   structure, small chipped hollows and long joint-tone fissures, and no
 *   slab joints at all.
 * - **Scars are few.** A drill scar every 8 px read as a picket fence along
 *   every face. Now a tall north face carries at most one long leaning gouge
 *   in a `GOUGE_SPAN`-pixel stretch, in fewer than half of them, and the
 *   other faces none.
 *
 * The taller faces are also what pushed the stone page's darkest window past
 * the §3 span of 1.25 (to 1.43). The limit is not moved; the lit course
 * banding, the joint-tone joints on the right-facing wall and the one-pixel
 * foot bring it back inside, which `quarry-route-ground.test.ts` holds.
 */
import { parseHex } from './lib/image';
import { tileNoise } from '../../src/render/painters/shapes';
import { fieldNoise, QUARRY_GROUND_TONES } from './quarry-village-material';
import type { QuarryMaterial, Rgb } from './quarry-village-material';
import type { MapDef } from '../../src/core/types';

/** One course of cut block, as the shared rock's (`ROCK_COURSE`). */
export const COURSE = 16;
/** The rows of the north cut, the face the road was driven through. */
export const CUTTING_NORTH_FACE_LAST_ROW = 3;
/** How high the north cut's rock stands above the road: four courses. */
export const NORTH_RISE = 4 * COURSE;
/** How high the south run's rock stands above its bays: two courses. */
export const SOUTH_RISE = 2 * COURSE;
/** A tier-1 ledge stands one course, as the forest's shelf does. */
export const LEDGE_RISE = COURSE;
/** One gouge at most in every stretch of this many pixels along a tall face. */
export const GOUGE_SPAN = 72;
/** The share of stretches that draw one. */
const GOUGE_SHARE = 0.4;

/** A cut block runs this far along its course, give or take: a bench, not brickwork. */
const BLOCK = 56;
/** How finely the hollows break the rock's top, per tile. */
const HOLLOW_SCALE = 3.2;
/** How far down each course its lit upper band reaches, rim line included. */
const CHAMFER = 10;
/** Where the smooth field breaks the rock's top into a hollow. */
const HOLLOW = 0.72;
const LIP_INK = 2;
/** The foot takes one pixel; the footprint's own ink line either side does the rest. */
const FOOT_INK = 1;

/** Logical coordinates of a world pixel. */
const logical = (wx: number, wy: number): { x: number; y: number } => ({
  x: ((wx - 768) / 64 + wy / 32) / 2,
  y: (wy / 32 - (wx - 768) / 64) / 2,
});

export type RaisedPainter = (
  material: QuarryMaterial,
  wx: number,
  wy: number,
  rim: boolean,
) => Rgb | null;

/**
 * The painter for the Cutting's `X` and `^` pixels, or null for any other
 * cell. `rim` is whether the pixel sits in the lit rim of its cell's
 * up-screen edge; only a ledge top takes it, since the rock's top is rough.
 */
export function cuttingRaised(map: MapDef): RaisedPainter {
  const keyAt = (wx: number, wy: number): { key: string | undefined; y: number } => {
    const { x, y } = logical(wx, wy);
    return { key: map.rows[Math.floor(y)]?.[Math.floor(x)], y: Math.floor(y) };
  };
  /** How far a cell's surface stands above the road, in world pixels. */
  const height = (key: string | undefined, row: number): number =>
    key === 'X'
      ? row <= CUTTING_NORTH_FACE_LAST_ROW
        ? NORTH_RISE
        : SOUTH_RISE
      : key === '^'
        ? LEDGE_RISE
        : 0;
  const block = QUARRY_GROUND_TONES.block;
  const tone = {
    base: parseHex(block.base),
    shadow: parseHex(block.shadow),
    rim: parseHex(block.rim),
    joint: parseHex(block.joint),
  } as const;

  /** The rough top of the rock at a logical point. */
  const roughTop = (material: QuarryMaterial, x: number, y: number): Rgb => {
    // Long fissures: the level line of a smooth field, broken where a second
    // field says the crack has closed.
    const crack = Math.abs(fieldNoise(x * 0.9, y * 0.9, 91) - 0.5);
    if (crack < 0.012 && fieldNoise(x * 1.7, y * 1.7, 93) > 0.45) return tone.joint;
    // Chipped hollows where the last lift was levered off: small patches of
    // the shadow, their broken near lip catching the light.
    const hollowAt = (hx: number, hy: number): boolean =>
      fieldNoise(hx * HOLLOW_SCALE + 3, hy * HOLLOW_SCALE + 7, 95) > HOLLOW;
    if (hollowAt(x, y)) return hollowAt(x + 0.025, y + 0.025) ? tone.shadow : tone.rim;
    // Elsewhere the spoil row's chipped structure, turned off the grid, in the
    // block's own tones and without its sparkle: rock, not a laid slab.
    return material.classOf('spoil', (x + y) * 1.1 + 17, (y - x) * 1.1 + 5) === 'shadow'
      ? tone.shadow
      : tone.base;
  };

  return (material, wx, wy, rim) => {
    const here = keyAt(wx, wy);
    const own = height(here.key, here.y);
    if (own <= 0) return null;
    // Walk down-screen to the first ground lower than this surface.
    let drop = 1;
    let front = keyAt(wx, wy + drop);
    while (drop <= own && height(front.key, front.y) >= own) front = keyAt(wx, wy + ++drop);
    // Off the board the rock stands one course over the surround's terrace.
    const rise = front.key === undefined ? COURSE : own - height(front.key, front.y);
    if (drop > rise) {
      const top = logical(wx, wy + own);
      if (here.key === '^')
        return rim ? material.rimOf('block') : material.colour('block', top.x, top.y);
      return roughTop(material, top.x, top.y);
    }
    const foot = logical(wx, wy + drop - 1);
    const exit = logical(wx, wy + drop);
    const right =
      Math.floor(exit.x) > Math.floor(foot.x) && Math.floor(exit.y) === Math.floor(foot.y);
    const face = drop - 1;
    if (drop > rise - LIP_INK || face < FOOT_INK) return material.ink;
    const course = Math.floor(face / COURSE);
    // Blocks break joint course to course, and each runs its own length.
    const run = Math.floor(wx) + course * (BLOCK / 2);
    const index = Math.floor(run / BLOCK);
    const jointAt = index * BLOCK + 4 + Math.floor(tileNoise(index, course, 7) * (BLOCK - 8));
    const joint = face % COURSE === 0 || run === jointAt;
    if (joint) return tone.joint;
    // Each course catches the light on its upper arris: on the left-facing
    // wall a pale line under the joint, a band of the base, then the shadow;
    // on the right-facing wall, turned further from the light, a narrower band
    // and no pale line. It is what stacks the courses into height, and it is
    // also what keeps a window full of tall face inside the §3 span of the
    // paving.
    const up = face % COURSE;
    if (right) return up >= COURSE - CHAMFER / 2 ? tone.base : tone.shadow;
    if (rise >= 3 * COURSE) {
      const gouge = gougeAt(wx, face, rise);
      if (gouge) return tone[gouge];
    }
    return up >= COURSE - 1 ? tone.rim : up >= COURSE - CHAMFER ? tone.base : tone.shadow;
  };
}

/**
 * A plug-and-feather gouge on a tall north face: one long groove, leaning,
 * from under the top lip down most of the face, in one stretch of
 * `GOUGE_SPAN` pixels out of every few. Its floor is the joint tone and its
 * lit side one pixel of the block's base.
 */
function gougeAt(wx: number, face: number, rise: number): 'joint' | 'base' | null {
  const stretch = Math.floor(wx / GOUGE_SPAN);
  if (tileNoise(stretch, 0, 13) > GOUGE_SHARE) return null;
  const top = rise - LIP_INK - 3 - Math.floor(tileNoise(stretch, 1, 13) * 6);
  const length = Math.floor(rise * (0.5 + 0.3 * tileNoise(stretch, 2, 13)));
  if (face > top || face < top - length) return null;
  const start =
    stretch * GOUGE_SPAN + 12 + Math.floor(tileNoise(stretch, 3, 13) * (GOUGE_SPAN - 24));
  const lean = tileNoise(stretch, 4, 13) > 0.5 ? 0.35 : -0.35;
  const at = start + Math.round((top - face) * lean);
  const column = Math.floor(wx);
  if (column === at) return 'joint';
  return column === at - Math.sign(lean) ? 'base' : null;
}
