/** Saltstep and Emberwatch's top-down layouts (CI and the ground packer only; see `../types.ts`). */
import type { TopDownLayout } from '../../topdownLayout';
import {
  EMBERWATCH_PARADE_TOPDOWN_LAYOUT,
  EMBERWATCH_POWER_YARD_TOPDOWN_LAYOUT,
  SALTSTEP_PONTOON_TOPDOWN_LAYOUT,
} from '../../scenes/rg02.topdown';

// TODO(region): the Saltstep market is a grey blockout with no layout until its dressing stage
// (`docs/places/saltstep_market.md`).
export const SALTSTEP_EMBERWATCH_LAYOUTS: readonly TopDownLayout[] = [
  SALTSTEP_PONTOON_TOPDOWN_LAYOUT,
  EMBERWATCH_PARADE_TOPDOWN_LAYOUT,
  EMBERWATCH_POWER_YARD_TOPDOWN_LAYOUT,
];
