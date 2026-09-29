/**
 * The cut quarry rock (legend `X`), shared by the quarry gate's corners and the
 * Driller floor's terrace wall so the two scenes stand one rock, not two.
 *
 * It is painted into a ground page the way `forest-raised-shelf.ts` stands its
 * shelf: the top is the footprint lifted by `ROCK_RISE`, and wherever the
 * ground under a pixel's top would already be off the rock, that pixel is the
 * block face instead, so the face stands straight up from the rock's
 * down-screen (+x/+y) edges inside the rules' own cells and never paints over a
 * playable one.
 */
import { parseHex } from './lib/image';
import { tileNoise } from '../../src/render/painters/shapes';
import { QUARRY_GROUND_TONES } from './quarry-village-material';
import type { QuarryMaterial, Rgb } from './quarry-village-material';

/**
 * How far the cut rock stands above the terrace, in world pixels: two courses
 * of `ROCK_COURSE`, one per tier of its elevation, so it reads a full step above
 * the tier-1 `^` shoulders in front of it. The forest's tier-1 shelf stands
 * `SHELF_RISE` (16); this is the same face at twice the height.
 */
export const ROCK_RISE = 32;
export const ROCK_COURSE = ROCK_RISE / 2;
const ROCK_BLOCK = 32;
const LIP_INK = 2;

/** Logical cell coordinates of a world pixel. */
const logical = (wx: number, wy: number): { x: number; y: number } => ({
  x: ((wx - 768) / 64 + wy / 32) / 2,
  y: (wy / 32 - (wx - 768) / 64) / 2,
});

/**
 * The rock painter for one map's rows. The face is the `block` row's shadow,
 * never its pale tones: joint-tone joints on the left-facing wall, ink joints
 * on the right-facing one, turned further from the light. It is one step
 * lighter than the shelf's right wall (whose field is the joint tone) because
 * the rock shares a stone page, and the page's darkest window has to stay
 * inside the §3 span of its brightest paving. Toward the exterior the rock
 * stands one course over the surround's own terrace, not two over the board's
 * floor, which is also what keeps a front edge a low lip.
 *
 * `riseOnto` is the face's height above the ground in front of it (`undefined`
 * is off the board). The gate stands every face two courses over its terrace;
 * the Driller's follows the tiers, so its wall stands one course over the
 * tier-1 bench, two over the floor, and none over a tier-2 perch.
 */
export function rockPainter(
  rows: readonly string[],
  riseOnto: (key: string | undefined) => number = (key) =>
    key === undefined ? ROCK_COURSE : ROCK_RISE,
): (material: QuarryMaterial, wx: number, wy: number, rim: boolean) => Rgb {
  const keyAt = (wx: number, wy: number): string | undefined => {
    const { x, y } = logical(wx, wy);
    return rows[Math.floor(y)]?.[Math.floor(x)];
  };
  return (material, wx, wy, rim) => {
    let drop = 1;
    const level = (key: string | undefined): boolean => key === 'X' || riseOnto(key) <= 0;
    while (drop <= ROCK_RISE && level(keyAt(wx, wy + drop))) drop++;
    const rise = riseOnto(keyAt(wx, wy + drop));
    if (drop > rise) {
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
  };
}
