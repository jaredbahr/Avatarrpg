/**
 * Every region's top-down layouts, in the same order as `REGIONS` (ADR 0111). CI and the ground
 * packer only: the terrain classifiers stay out of the shipped game.
 */
import type { TopDownLayout } from '../topdownLayout';
import { BA_DAN_VALLEY_LAYOUTS } from './baDanValley/layouts';
import { SALTSTEP_EMBERWATCH_LAYOUTS } from './saltstepEmberwatch/layouts';

export const REGION_LAYOUTS: readonly (readonly TopDownLayout[])[] = [
  BA_DAN_VALLEY_LAYOUTS,
  SALTSTEP_EMBERWATCH_LAYOUTS,
];
