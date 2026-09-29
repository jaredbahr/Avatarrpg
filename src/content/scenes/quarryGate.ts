import type { MapScene, SceneScenery, Vec2 } from '../../core/types';
import { quarryCribbing } from './quarryExteriorRims';
import { QUARRY_SURROUND } from './quarryProjected';
import { QUARRY_WEST_FRAMES } from './quarryWestFrames';

const root = 'art/maps/quarry-gate-scene/';
export const QUARRY_GATE_GROUND_REGIONS = [
  { name: 'earth-west', x: 191, y: 94, width: 1218, height: 612 },
  { name: 'earth-east', x: 639, y: 318, width: 1282, height: 644 },
  { name: 'road', x: 319, y: 158, width: 1410, height: 708 },
  { name: 'limestone', x: -1, y: -2, width: 2050, height: 1028 },
] as const;
export const QUARRY_GATE_COVER_CELLS: readonly Vec2[] = [
  { x: 13, y: 2 },
  { x: 5, y: 3 },
  { x: 5, y: 8 },
  { x: 14, y: 9 },
];
export const QUARRY_GATE_WALL_CELLS: readonly Vec2[] = [0, 1, 10, 11].flatMap((y) =>
  (y === 0 || y === 11 ? [4, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 17] : [4, 9, 12, 17]).map((x) => ({
    x,
    y,
  })),
);
export function quarryWallVariant({ x, y }: Vec2): 'interior' | 'end' | 'corner' {
  const has = (dx: number, dy: number) =>
    QUARRY_GATE_WALL_CELLS.some((cell) => cell.x === x + dx && cell.y === y + dy);
  const horizontal = Number(has(-1, 0)) + Number(has(1, 0));
  const vertical = Number(has(0, -1)) + Number(has(0, 1));
  if (horizontal + vertical <= 1) return 'end';
  return horizontal > 0 && vertical > 0 ? 'corner' : 'interior';
}

/** The barred side gates (legend `G`), one pair of cells in each gatehouse gap. */
export const QUARRY_GATE_GATE_CELLS: readonly Vec2[] = [0, 11].flatMap((y) =>
  [10, 11].map((x) => ({ x, y })),
);

/**
 * The timber post of the north-west gatehouse's jamb (`quarry-wall-9-0`), from
 * its cap to just below its lower iron band. A gate is `GATE_POSTS` of them
 * shoulder to shoulder, so the gatehouse's own planks and straps bar the gap
 * rather than a second drawing of timber.
 */
const GATE_POST_SOURCE = { x: 653, y: 546, width: 67, height: 386 } as const;
/**
 * Posts overlap by a third, so the gate's top steps down the slope in short
 * plank-width treads rather than a sawtooth of whole posts.
 */
const GATE_POSTS = 8;
/** World pixels per source pixel: a gate a little under the jamb, above the curtain wall. */
const GATE_POST_SCALE = 0.38;
/** The flat foot sits this far below the gate line, so it never floats on the slope. */
const GATE_POST_SINK = 4;

/**
 * One gate, standing on the centre line of its two cells from the jamb face to
 * the next wall. Posts alternate their mirror so the rivets do not repeat.
 */
export function quarryGatePosts(y: number): SceneScenery[] {
  const width = GATE_POST_SOURCE.width * GATE_POST_SCALE;
  const height = GATE_POST_SOURCE.height * GATE_POST_SCALE;
  return Array.from({ length: GATE_POSTS }, (_, index) => {
    const gx = 10 + (2 * (index + 0.5)) / GATE_POSTS;
    const gy = y + 0.5;
    const footX = 768 + (gx - gy) * 64;
    const footY = (gx + gy) * 32;
    return {
      id: `quarry-gate-post-${y}-${index}`,
      url: `${root}west-structure.webp`,
      sourceRect: GATE_POST_SOURCE,
      x: footX - width / 2,
      y: footY + GATE_POST_SINK - height,
      width,
      height,
      footprint: [{ x: Math.floor(gx), y }],
      depth: { x: gx, y: gy },
      fadeWhenOccluding: true,
      fadeGroup: `quarry-gate-${y}`,
      ...(index % 2 === 1 ? { flip: true } : {}),
    };
  });
}

/** The two-row edge bands either side of the rows 5-6 road mouths (`QUARRY_GATE.edges`). */
export const QUARRY_GATE_BAND_ROWS = [3, 7] as const;

/**
 * East: the quarry's outer curtain wall, one gatehouse block outside each
 * band cell, so the road mouth between them reads as the way out through it.
 * They stand in front of the board, so they fade for a figure behind them.
 */
const curtain = (top: number): SceneScenery[] =>
  [top, top + 1].map((y) => ({
    id: `quarry-gate-curtain-20-${y}`,
    url: `${root}wall-end.webp`,
    x: 768 + (20 - y) * 64 - 64,
    y: (20 + y + 1) * 32 - 144,
    width: 128,
    height: 176,
    footprint: [{ x: 20, y }],
    depth: { x: 20.5, y: y + 0.5 },
    exterior: true,
    fadeWhenOccluding: true,
    fadeGroup: `quarry-gate-curtain-${top}`,
  }));

/** Registered gate art only. Gameplay owns projection opt-in and live surfaces/props. */
export const QUARRY_GATE_SCENE: MapScene = {
  // Each local region is sampled from reusable material panels against the
  // authoritative rows. The partial renderer keeps the mutable oil/props and
  // collision fallback beneath it; upright walls remain separate scenery.
  groundMode: 'partial',
  ground: [
    // The gatehouse stands on the quarry's own terrace, so it wears the same
    // exterior mass as The Cutting. Without it the projected diamond's edge
    // floats on bare backdrop along the left and bottom of the frame.
    ...QUARRY_SURROUND,
    ...QUARRY_GATE_GROUND_REGIONS.map(({ name, ...region }) => ({
      url: `${root}${name}.webp`,
      ...region,
    })),
    ...QUARRY_GATE_COVER_CELLS.map(({ x, y }) => ({
      url: `${root}cover-timber.webp`,
      x: 768 + (x - y) * 64 - 56,
      y: (x + y + 1) * 32 - 24,
      width: 112,
      height: 48,
    })),
  ],
  scenery: [
    ...QUARRY_GATE_WALL_CELLS.map(
      ({ x, y }) =>
        QUARRY_WEST_FRAMES.find(
          (piece) => piece.footprint[0].x === x && piece.footprint[0].y === y,
        ) ?? {
          id: `quarry-wall-${x}-${y}`,
          url: `${root}wall-${quarryWallVariant({ x, y })}.webp`,
          x: 768 + (x - y) * 64 - 64,
          y: (x + y + 1) * 32 - 144,
          width: 128,
          height: 176,
          footprint: [{ x, y }],
          depth: { x: x + 0.5, y: y + 0.5 },
          fadeWhenOccluding: true,
        },
    ),
    // The barred side gates stand in the gatehouse gaps (M4 §1.4).
    ...quarryGatePosts(0),
    ...quarryGatePosts(11),
    // The rim bands (M4 §1.4): cribbed spoil bank west, curtain wall east.
    ...QUARRY_GATE_BAND_ROWS.map((top) => quarryCribbing('quarry-gate', top)),
    ...QUARRY_GATE_BAND_ROWS.flatMap(curtain),
  ],
};
