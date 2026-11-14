/**
 * The top-down layouts (ADR 0104 §3), by map: what the content validation checks against each map's
 * rows and what the ground packer bakes. Each region keeps its own in its `layouts.ts` (ADR 0111).
 * CI and the packer import this; the shipped runtime never does (it would pull the terrain
 * classifier into the bundle), so it is not part of `CONTENT_BUNDLE`.
 */
import type { TopDownLayout } from './topdownLayout';
import { REGION_LAYOUTS } from './regions/layouts';

export {
  BA_DAN_TOPDOWN_LAYOUT,
  CUTTING_TOPDOWN_LAYOUT,
  FOREST_TOPDOWN_LAYOUT,
  QUARRY_FLOOR_TOPDOWN_LAYOUT,
  QUARRY_GATE_TOPDOWN_LAYOUT,
} from './regions/baDanValley/layouts';

export const TOPDOWN_LAYOUTS: readonly TopDownLayout[] = REGION_LAYOUTS.flat();
