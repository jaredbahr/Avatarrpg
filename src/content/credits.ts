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
    note: 'Hand-drawn-style effect sheets generated for this project, normalised into 48 transparent animation cels, plus a reused flask prop. Prompts and provenance: docs/art/elemental-cels.md; docs/art/deserter-material-fx.md. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.',
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
    work: 'Hero and NPC portraits, hero motion sheets, quarry bandit and mercenary combat sheets',
    authors: 'This project, generated with OpenAI image generation',
    licence: 'own work',
    source: '',
    covers: ['art/portraits', 'art/units'],
    note: 'Generated from the project character references and prompt packs, then normalised and packed for the game. Dialogue portrait notes: docs/art/dialogue-portraits.md; bandit prompts: docs/art/bandit.md; remaining quarry bandits: docs/art/quarry-bandits.md; crossbow prompts and review: docs/art/crossbow.md; Cutting figures: docs/art/cutting-characters.md; fire deserter: docs/art/fire-deserter-runtime.md; hero walk prompts and review: docs/art/side-walks.md; Riko directional contact prompts, source provenance and reproducible packer: docs/art/prompts/sheets/unit.non.riko.md and docs/art/sources/riko-directional-contact/. Output terms: https://openai.com/policies/row-terms-of-use/. This credit does not claim exclusive copyright in generated output.',
  },
  {
    what: 'The Grumbler artwork',
    work: 'Quarry driller pose sheet and machine portrait',
    authors: 'This project, generated with OpenAI image generation',
    licence: 'own work',
    source: '',
    covers: [
      'art/units/grumbler.png',
      'art/units/grumbler.json',
      'art/portraits/enemy.grumbler.png',
    ],
    note: 'Original quarry machine artwork, generated and packed into nine transparent poses and a UI portrait. Prompts and processing notes: docs/art/grumbler.md. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.',
  },
  {
    what: 'The village NPC sprites',
    work: 'Mira, Gao, Pella and Dorin idle illustrations',
    authors: 'This project, generated with OpenAI image generation',
    licence: 'own work',
    source: '',
    covers: ['art/npcs'],
    note: 'Original full-body illustrations based on the approved dialogue portraits. Prompts, packing and shared archetype limitations: docs/art/npc-idles.md. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.',
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
    work: 'Five map paintings, six combat props and the workers’ tea station',
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
    note: 'Original generated environments registered to the authored map layouts, with transparent props packed separately. Prompts and processing notes: docs/art/act1-environments.md; worn cart refresh: docs/art/quarry-gate-material-pass.md; workers’ tea station: docs/art/tea-station.md. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.',
  },
  {
    what: 'The layered Ba Dan courtyard',
    work: 'Calibrated ground, low-rise houses, pond and village tree',
    authors: 'This project, generated with OpenAI image generation',
    licence: 'own work',
    source: '',
    covers: ['art/maps/ba-dan-scene'],
    note: 'Original generated material and scenery art, packed against the logical village map. Exact prompts, processing and registration: docs/art/ba-dan-scene.md and docs/art/ba-dan-scene-prompts.json. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.',
  },
  {
    what: 'The layered Forest Road',
    work: 'Registered ground, eight-cell water, low rubble and upright pines',
    authors: 'This project, generated with OpenAI image generation',
    licence: 'own work',
    source: '',
    covers: ['art/maps/forest-scene'],
    note: 'Original generated art registered to the existing terrain without collision changes. Source IDs, prompts, masking and anchors: docs/art/forest-scene-registration.md. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.',
  },
  {
    what: 'The registered quarry gate art',
    work: 'Quarry material textures, low timber cover and modular limestone walls',
    authors: 'This project, generated with OpenAI image generation',
    licence: 'own work',
    source: '',
    covers: ['art/maps/quarry-gate-scene'],
    note: 'Original generated materials packed through authoritative map-cell masks, with separate transparent timber and wall pieces. The initial wholeplate was rejected for semantic drift. Prompts, provenance and repair notes: docs/art/quarry-gate-registration.md; weathered material refresh: docs/art/quarry-gate-material-pass.md. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.',
  },
  {
    what: 'The registered Cutting and Driller ground art',
    work: 'Projected Cutting road and Quarry Floor ground compositions with exterior rim textures',
    authors: 'This project, generated with OpenAI image generation',
    licence: 'own work',
    source: '',
    covers: ['art/maps/cutting-scene', 'art/maps/driller-floor-scene', 'art/maps/quarry-surround'],
    note: 'Original generated full-scene ground sources and transparent rim candidates, measured and clipped to authoritative projected map geometry. Upright cliffs and live rules overlays remain separate. Provenance and registration: docs/art/cutting-driller-ground-registration.md, docs/art/exterior-quarry-rim-candidate-registration.md, docs/art/quarry-terrace-composition.md, docs/art/quarry-surround-composition.md, and docs/coordination/handoffs/quarry-southwest-structure.md. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.',
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
