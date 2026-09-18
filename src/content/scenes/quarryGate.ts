import type { MapScene, Vec2 } from '../../core/types';

const root = 'art/maps/quarry-gate-scene/';
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
  ground: [
    { url: `${root}ground-west.webp`, x: -128, y: -192, width: 1152, height: 1280 },
    { url: `${root}ground-east.webp`, x: 1024, y: -192, width: 1152, height: 1280 },
  ],
  scenery: QUARRY_GATE_WALL_CELLS.map(({ x, y }) => ({
    id: `quarry-wall-${x}-${y}`,
    url: `${root}wall-${quarryWallVariant({ x, y })}.webp`,
    x: 768 + (x - y) * 64 - 64,
    y: (x + y + 1) * 32 - 144,
    width: 128,
    height: 176,
    footprint: [{ x, y }],
    depth: { x: x + 0.5, y: y + 0.5 },
    fadeWhenOccluding: true,
  })),
};
