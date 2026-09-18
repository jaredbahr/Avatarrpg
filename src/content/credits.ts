/**
 * Who made what, and under which licence.
 *
 * One list, three readers: the Credits view in the pause menu, the `NOTICE`
 * file at the repository root (generated from here by `npm run credits`, with
 * a test that compares the two), and the asset check, which refuses to ship a
 * folder under `public/` that no entry accounts for. The game and the
 * repository therefore cannot disagree about a credit, and art cannot arrive
 * without one.
 *
 * A work under a licence that asks for attribution has to appear in the game,
 * not only in the repository, which is why this is content rather than a
 * document. Add the entry in the same commit as the files.
 */

/** Licences this project accepts. `own work` is ours; the rest are third-party. */
export type Licence =
  'own work' | 'CC0 1.0' | 'CC BY 3.0' | 'CC BY 4.0' | 'SIL Open Font License 1.1';

/** Licences that require the author to be named wherever the work is used. */
const ATTRIBUTION_REQUIRED: readonly Licence[] = [
  'CC BY 3.0',
  'CC BY 4.0',
  'SIL Open Font License 1.1',
];

export function needsAttribution(licence: Licence): boolean {
  return ATTRIBUTION_REQUIRED.includes(licence);
}

export interface CreditEntry {
  /** What it is, in the words a player would use. */
  readonly what: string;
  /** The work's own name. */
  readonly work: string;
  /** Who made it, named the way the licence asks for. */
  readonly authors: string;
  readonly licence: Licence;
  /** Where it came from. Empty for our own work. */
  readonly source: string;
  /**
   * Paths under `public/` this entry accounts for, as a folder or a file.
   * The asset check walks what ships and fails on anything uncovered.
   */
  readonly covers: readonly string[];
  /** Anything the licence or the reader needs beyond the fields above. */
  readonly note?: string;
}

/** Kept separate so the game can omit build-only provenance from its bundle. */
export const THIRD_PARTY_CREDITS: readonly CreditEntry[] = [
  {
    what: 'The heading typeface',
    work: 'Shippori Mincho 700, Latin subset',
    authors: 'The Shippori Mincho Project Authors',
    licence: 'SIL Open Font License 1.1',
    source: 'https://github.com/fontdasu/ShipporiMincho',
    covers: ['fonts'],
    note: 'The licence travels with the font in public/fonts/OFL-ShipporiMincho.txt, as the OFL requires.',
  },
  {
    what: 'The action icons',
    work: 'Game Icons',
    authors: 'the Game Icons contributors',
    licence: 'CC BY 3.0',
    source: 'https://github.com/game-icons/icons',
    covers: ['art/icons'],
    note: 'One icon per kind of action, chosen in src/app/ui/icons.ts and built into a sprite by npm run art:icons. Each icon is by a named contributor; they are listed in the licence file at the source above.',
  },
  {
    what: 'The sound effects',
    work: 'Impact Sounds 1.0 and Interface Sounds 1.0',
    authors: 'Kenney (kenney.nl)',
    licence: 'CC0 1.0',
    source: 'https://kenney.nl',
    covers: ['audio'],
    note: 'Footsteps, impacts, splintering wood and the interface. The bending sounds are not here: these packs contain none, so an element’s voice is rendered in the Web Audio graph from the description in src/content/sounds.ts rather than played from a file.',
  },
];

export const CREDITS: readonly CreditEntry[] = [
  {
    what: 'The bending animation cels',
    work: 'Fire, water, earth and air effects, with lightning, ice, healing and metal',
    authors: 'This project, generated with OpenAI image generation',
    licence: 'own work',
    source: '',
    covers: ['art/fx'],
    note: 'Hand-drawn-style effect sheets generated for this project, normalised into 48 transparent animation cels. Prompts and provenance: docs/art/elemental-cels.md. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.',
  },
  {
    what: 'The illustrated story scenes',
    work: 'Ba Dan, the east road, the quarry and the distant outpost',
    authors: 'This project, generated with OpenAI image generation',
    licence: 'own work',
    source: '',
    covers: ['art/interludes'],
    note: 'Stationary cutscene paintings generated for this project. Prompts and provenance: docs/art/interludes.md. Output terms: https://openai.com/policies/terms-of-use/. No exclusive copyright in generated output is claimed.',
  },
  {
    what: 'The character art',
    work: 'Hero and NPC portraits, hero motion sheets, quarry bandit and crossbow combat sheets',
    authors: 'This project, generated with OpenAI image generation',
    licence: 'own work',
    source: '',
    covers: ['art/portraits', 'art/units'],
    note: 'Generated from the project character references and prompt packs, then normalised and packed for the game. Dialogue portrait notes: docs/art/dialogue-portraits.md; bandit prompts: docs/art/bandit.md; remaining quarry bandits: docs/art/quarry-bandits.md; crossbow prompts and review: docs/art/crossbow.md; hero walk prompts and review: docs/art/side-walks.md. Output terms: https://openai.com/policies/row-terms-of-use/. This credit does not claim exclusive copyright in generated output.',
  },
  {
    what: 'The riverside painting',
    work: 'Ba Dan riverside',
    authors: 'This project, with OpenAI image generation',
    licence: 'own work',
    source: '',
    covers: ['art/maps/ba_dan_riverside.webp'],
    note: 'Original generated environment for the living-village prototype. Foreground silhouettes are composited at ground depth. Riverside hero walk and wave sheets are generated; animals and elemental effects are drawn by the game. See docs/art/riverside.md.',
  },
  {
    what: 'The Act 1 environments',
    work: 'Five map paintings and six interactable prop sprites',
    authors: 'This project, generated with OpenAI image generation',
    licence: 'own work',
    source: '',
    covers: [
      'art/maps/ba_dan_village.webp',
      'art/maps/forest_road.webp',
      'art/maps/quarry_gate.webp',
      'art/maps/ambush_road.webp',
      'art/maps/quarry_floor.webp',
      'art/props',
    ],
    note: 'Original generated environments registered to the authored map layouts, with transparent props packed separately. Prompts and processing notes: docs/art/act1-environments.md. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.',
  },
  ...THIRD_PARTY_CREDITS,
  {
    what: 'The app icons',
    work: 'Four Nations Tactics icons',
    authors: 'This project',
    licence: 'own work',
    source: '',
    covers: ['icons'],
    note: 'Drawn by scripts/make-icons.mjs.',
  },
  {
    what: 'The test art',
    work: 'Probe atlas and probe painting',
    authors: 'This project',
    licence: 'own work',
    source: '',
    covers: ['art/test'],
    note: 'Flat colour stand-ins the end-to-end tests read back; never seen in play.',
  },
];

/** The third-party works, which are the ones a credits screen exists for. */
export function thirdParty(entries: readonly CreditEntry[] = CREDITS): CreditEntry[] {
  return entries.filter((entry) => entry.licence !== 'own work');
}
