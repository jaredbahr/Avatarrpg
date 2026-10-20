/**
 * Reproducibly packs the bandit slinger's hit reactions (eight headings) and
 * knockouts (the four screen diagonals) onto pages of his G sheet and writes
 * his clip data (ADR 0059, ADR 0063, ADR 0079), by the shared enemy packer
 * (`enemy-clips.ts`), as `thug-clips.ts` does for the thug.
 *
 * Usage:
 *   node --import tsx scripts/art/slinger-clips.ts [--source art/source/slinger-actions-g/cels] [--pin]
 *
 * The source is `art/source/slinger-actions-g/cels`, written by that folder's
 * `assemble.py`: frame 0 of each take is the slinger's own idle cel 0 for the
 * heading, the rest are PixelLab cels drawn from his approved rotation (the
 * same first frame, direction name and camera as his walk) along a skeleton
 * retargeted from CMU capture (`design/`), toned with the frozen `params-v3.json`
 * and his own skin mask, as his idle and walk were (`tone/tone_p1.py`). The motion
 * is CMU Graphics Lab mocap, free for any use, credited in `NOTICE.md`.
 *
 * Placement is the idle's own (`PLACEMENTS.slinger` of `bandits-g.ts`), so a take
 * starts on the idle's feet at the idle's size and the clip's anchor is the
 * sheet's (0.5, 0.85) foot point.
 */

import { resolve } from 'node:path';
import { BANDITS, BANDIT_TONE } from './bandits-g';
import type { EnemyClipUnit } from './enemy-clips';
import { buildEnemyClips, enemyClipDataFile, pinEnemyClipSources } from './enemy-clips';
import { argValue } from './enemy-g';

export const SLINGER_KEY = BANDITS.slinger.key;
export const SLINGER_CLIP_PINS = 'art/source/slinger-actions-g/pins.json';
export const SLINGER_CLIP_SOURCE = 'art/source/slinger-actions-g/cels';

export const SLINGER_CLIPS: EnemyClipUnit = {
  key: SLINGER_KEY,
  name: 'slinger',
  pins: SLINGER_CLIP_PINS,
  source: SLINGER_CLIP_SOURCE,
  tone: BANDIT_TONE,
  headings: BANDITS.slinger.headings,
  idlePins: BANDITS.slinger.pins,
};

/** Where the clip data ships, relative to the site root: the sheet's `clipData`. */
export const SLINGER_CLIP_DATA = enemyClipDataFile('slinger');

if (process.argv[1]?.endsWith('slinger-clips.ts')) {
  const argv = process.argv.slice(2);
  const source = resolve(argValue(argv, '--source') ?? SLINGER_CLIP_SOURCE);
  if (argv.includes('--pin')) {
    pinEnemyClipSources(source, SLINGER_CLIPS, SLINGER_CLIP_PINS);
    console.log(`wrote ${SLINGER_CLIP_PINS} source pins`);
  } else {
    await buildEnemyClips(SLINGER_CLIPS, source, {
      outDir: resolve(argValue(argv, '--out') ?? 'public/art/units'),
      dataPath: resolve(argValue(argv, '--out') ?? 'public/art/units', 'slinger-g-clips.json'),
    });
  }
}
