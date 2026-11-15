/** Saltstep and Emberwatch's top-down layouts (CI and the ground packer only; see `../types.ts`). */
import type { TopDownLayout } from '../../topdownLayout';
import {
  SALTSTEP_MARKET_TOPDOWN_LAYOUT,
  SALTSTEP_PONTOON_TOPDOWN_LAYOUT,
} from '../../scenes/rg02.topdown';

// Emberwatch's two boards (the parade ground and the power yard) are still to be drawn
// (`docs/pipeline-trial-log.md`, "Boards still to build").
export const SALTSTEP_EMBERWATCH_LAYOUTS: readonly TopDownLayout[] = [
  SALTSTEP_MARKET_TOPDOWN_LAYOUT,
  SALTSTEP_PONTOON_TOPDOWN_LAYOUT,
];
