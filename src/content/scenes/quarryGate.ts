import type { MapScene, Vec2 } from '../../core/types';
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

/** Registered gate art only. Gameplay owns projection opt-in and live surfaces/props. */
export const QUARRY_GATE_SCENE: MapScene = {
  // Each local region is sampled from reusable material panels against the
  // authoritative rows. The partial renderer keeps the mutable oil/props and
  // collision fallback beneath it; upright walls remain separate scenery.
  groundMode: 'partial',
  ground: [
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
  scenery: QUARRY_GATE_WALL_CELLS.map(
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
};
