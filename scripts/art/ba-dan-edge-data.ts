/**
 * Numbers the Ba Dan edge and canal-bank packers share with their tests and nothing else: they
 * lived in `src/content/scenes/baDan.ts` and shipped in the game's bundle for no reason.
 */
import type { Vec2 } from '../../src/core/types';

/** Outer metric radius of the transparent coping around runtime water. */
export const BA_DAN_CANAL_BANK_RADIUS = 1.42;
/** Ground-plane centres of the ford's drowned stepping stones, west from the road's end. */
export const BA_DAN_FORD_STONES: readonly Vec2[] = [
  { x: 0.6, y: 7.55 },
  { x: 0.05, y: 8.2 },
  { x: -0.55, y: 7.6 },
  { x: -1.15, y: 8.25 },
  { x: -1.75, y: 7.65 },
];
/** The page the edge water ships on, in source pixels. */
export const BA_DAN_EDGE_WATER_PAGE = { width: 1016, height: 700 } as const;
