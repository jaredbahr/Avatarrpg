/**
 * Ba Dan's canal, for the tests and the practice ground to read: the water cells the village rows mark `~`, and the
 * bridge that carries the paved crossing over them. The rows in `village.ts` are the rules; this restates the canal
 * so a test can say what it expects of them.
 */
import type { Vec2 } from '../../core/types';

const span = (x0: number, x1: number, y: number): Vec2[] =>
  Array.from({ length: x1 - x0 + 1 }, (_, i) => ({ x: x0 + i, y }));

/** The canal: rows 12-13 west of the bridge, the bridge's two columns clear, and rows 13-14 east of it. */
export const BA_DAN_WATER_CELLS: readonly Vec2[] = [
  ...span(1, 12, 12),
  { x: 15, y: 12 },
  ...span(1, 12, 13),
  ...span(15, 31, 13),
  ...span(16, 31, 14),
];

/** The bridge deck: (13..14, 12..13). `x` is its west column, `y` its north row. */
export const BA_DAN_CANAL_BRIDGE = { x: 13, y: 12 } as const;
