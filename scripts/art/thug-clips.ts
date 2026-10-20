/**
 * Reproducibly packs the thug's hit reactions (eight headings) and knockouts
 * (the four screen diagonals) onto pages of his G sheet and writes his clip
 * data (ADR 0059, ADR 0063), by the shared enemy packer (`enemy-clips.ts`).
 *
 * Usage:
 *   node --import tsx scripts/art/thug-clips.ts [--source art/source/thug-actions-g/cels] [--pin]
 *
 * The source is `art/source/thug-actions-g/cels`, written by that folder's
 * `assemble.py`: frame 0 of each take is the thug's own idle cel 0 for the
 * heading, the rest are PixelLab cels drawn from the thug's approved rotation
 * (the same first frame, direction name and camera as his walk) along a
 * skeleton retargeted from CMU capture (`design/`), toned with the frozen
 * `tone_thug.py` parameters his idle and walk were. The motion is CMU Graphics
 * Lab mocap, free for any use, credited in `docs/credits.md`'s CMU line.
 *
 * Placement is the idle's own (`headingDx`, `idleDy` of `thug-g.ts`), so a take
 * starts on the idle's feet at the idle's size and the clip's anchor is the
 * sheet's (0.5, 0.85) foot point.
 */

import { resolve } from 'node:path';
import type { EnemyClipUnit } from './enemy-clips';
import { buildEnemyClips, enemyClipDataFile, pinEnemyClipSources } from './enemy-clips';
import { THUG, THUG_KEY, THUG_PINS, THUG_TONE } from './thug-g';
import { argValue } from './enemy-g';

export const THUG_CLIP_PINS = 'art/source/thug-actions-g/pins.json';
export const THUG_CLIP_SOURCE = 'art/source/thug-actions-g/cels';

export const THUG_CLIPS: EnemyClipUnit = {
  key: THUG_KEY,
  name: 'thug',
  pins: THUG_CLIP_PINS,
  source: THUG_CLIP_SOURCE,
  tone: THUG_TONE,
  headings: THUG.headings,
  idlePins: THUG_PINS,
};

/** Where the clip data ships, relative to the site root: the sheet's `clipData`. */
export const THUG_CLIP_DATA = enemyClipDataFile('thug');

if (process.argv[1]?.endsWith('thug-clips.ts')) {
  const argv = process.argv.slice(2);
  const source = resolve(argValue(argv, '--source') ?? THUG_CLIP_SOURCE);
  if (argv.includes('--pin')) {
    pinEnemyClipSources(source, THUG_CLIPS, THUG_CLIP_PINS);
    console.log(`wrote ${THUG_CLIP_PINS} source pins`);
  } else {
    await buildEnemyClips(THUG_CLIPS, source, {
      outDir: resolve(argValue(argv, '--out') ?? 'public/art/units'),
      dataPath: resolve(argValue(argv, '--out') ?? 'public/art/units', 'thug-g-clips.json'),
    });
  }
}
