/**
 * Every region's data, in the same order as `REGIONS` (ADR 0111). The full content index
 * (`src/content/index.ts`) is built from this list, so tests, the balance report and the docs see
 * the whole world.
 */
import type { RegionContent } from './types';
import { BA_DAN_VALLEY_CONTENT } from './baDanValley/content';

export const REGION_CONTENT: readonly RegionContent[] = [BA_DAN_VALLEY_CONTENT];
