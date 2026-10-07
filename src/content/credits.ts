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
    what: 'The motion of the party’s knockouts',
    work: 'CMU Graphics Lab Motion Capture Database, subject 90 trial 18 and subject 77 trials 16 and 18',
    authors: 'Carnegie Mellon University Graphics Lab',
    licence: 'CMU Motion Capture Database terms',
  },
  {
    what: 'The motion of the party’s hit reactions',
    work: 'CMU Graphics Lab Motion Capture Database, subject 79 trial 73, subject 76 trial 03 and subject 77 trial 09',
    authors: 'Carnegie Mellon University Graphics Lab',
    licence: 'CMU Motion Capture Database terms',
  },
  {
    what: 'The motion of the thug’s and the quarry bandits’ walks',
    work: 'Mixamo “Unarmed Walk Forward”',
    authors: 'Adobe Mixamo',
    licence: 'Adobe Mixamo terms',
  },
];

export function needsAttribution(licence: Licence): boolean {
  return licence !== 'CC0 1.0' && licence !== 'Adobe Mixamo terms';
}
