/** The attribution fields shown by the in-game Credits dialog. */

export type Licence =
  | 'CC0 1.0'
  | 'CC BY 3.0'
  | 'SIL Open Font License 1.1'
  | 'CMU Motion Capture Database terms'
  | 'Adobe Mixamo terms';

export interface CreditEntry {
  readonly what: string;
  readonly work: string;
  readonly authors: string;
  readonly licence: Licence;
}

/**
 * Only player-visible attribution ships. Source links, covered asset paths and
 * provenance notes live in `credits.notice.ts`, used by the NOTICE generator
 * and asset-coverage test.
 */
export const THIRD_PARTY_CREDITS: readonly CreditEntry[] = [
  {
    what: 'The heading typeface',
    work: 'Shippori Mincho 700, Latin subset',
    authors: 'The Shippori Mincho Project Authors',
    licence: 'SIL Open Font License 1.1',
  },
  {
    what: 'The action icons',
    work: 'Game Icons',
    authors: 'the Game Icons contributors',
    licence: 'CC BY 3.0',
  },
  {
    what: 'The sound effects',
    work: 'Impact Sounds 1.0 and Interface Sounds 1.0',
    authors: 'Kenney (kenney.nl)',
    licence: 'CC0 1.0',
  },
  {
    what: 'The motion of the party’s, the thug’s, the slinger’s and the bruiser’s knockouts',
    work: 'CMU Graphics Lab Motion Capture Database, subject 90 trial 18 and subject 77 trial 16',
    authors: 'Carnegie Mellon University Graphics Lab',
    licence: 'CMU Motion Capture Database terms',
  },
  {
    what: 'The motion of the party’s, the thug’s, the slinger’s and the bruiser’s hit reactions',
    work: 'CMU Graphics Lab Motion Capture Database, subject 79 trial 73, subject 76 trial 03 and subject 77 trial 09',
    authors: 'Carnegie Mellon University Graphics Lab',
    licence: 'CMU Motion Capture Database terms',
  },
  {
    what: 'The motion of the party’s walks, breathing, fighting stance and bends',
    work: 'CMU Graphics Lab Motion Capture Database, subject 8 trial 1, subject 77 trials 2 and 3, subject 143 trial 23, subject 135 trial 4 and subject 12 trial 4',
    authors: 'Carnegie Mellon University Graphics Lab',
    licence: 'CMU Motion Capture Database terms',
  },
  {
    what: 'The motion of the Ba Dan residents’ and the forest bandits’ walks and breathing',
    work: 'CMU Graphics Lab Motion Capture Database, subject 8 trial 1 and subject 77 trial 2',
    authors: 'Carnegie Mellon University Graphics Lab',
    licence: 'CMU Motion Capture Database terms',
  },
  {
    what: 'The motion of the quarry bender’s walk',
    work: 'Mixamo “Unarmed Walk Forward”',
    authors: 'Adobe Mixamo',
    licence: 'Adobe Mixamo terms',
  },
];

export function needsAttribution(licence: Licence): boolean {
  return licence !== 'CC0 1.0' && licence !== 'Adobe Mixamo terms';
}
