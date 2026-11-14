/**
 * Who made what, and under which licence.
 *
 * The build-only credit list: the `NOTICE` file at the repository root is
 * generated from here, and the asset check refuses to ship a folder under
 * `public/` that no entry accounts for. The compact in-game attribution list
 * lives in `credits.ts`; a test keeps its player-visible fields in sync.
 *
 * A work under a licence that asks for attribution has to appear in the game,
 * not only in the repository, which is why this is content rather than a
 * document. Add the entry in the same commit as the files.
 */

/**
 * Licences this project accepts. `own work` is ours; the rest are third-party.
 * The CMU database's terms allow its motion in a product, not resale of the
 * data, and ask for an acknowledgement; Mixamo's allow its animations in a
 * game, not redistribution of the files. Neither is share-alike, which is why
 * they are here and CC BY-SA is not (ADR 0059).
 */
export type Licence =
  | 'own work'
  | 'CC0 1.0'
  | 'CC BY 3.0'
  | 'CC BY 4.0'
  | 'SIL Open Font License 1.1'
  | 'CMU Motion Capture Database terms'
  | 'Adobe Mixamo terms';

/** Licences that require the author to be named wherever the work is used. */
const ATTRIBUTION_REQUIRED: readonly Licence[] = [
  'CC BY 3.0',
  'CC BY 4.0',
  'SIL Open Font License 1.1',
  'CMU Motion Capture Database terms',
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
    note: 'Footsteps, impacts, splintering wood and the interface. These packs contain no bending sounds; those are generated (below) or rendered in the Web Audio graph from the description in src/content/sounds.ts.',
  },
  {
    what: 'The bending and projectile sounds',
    work: 'Fire, water, earth, air and lightning bends; thrown rock, sling and crossbow',
    authors: 'This project, generated with PixelLab',
    licence: 'own work',
    source: '',
    covers: [
      'audio/sfx-air.ogg',
      'audio/sfx-crossbow.ogg',
      'audio/sfx-earth.ogg',
      'audio/sfx-fire.ogg',
      'audio/sfx-lightning.ogg',
      'audio/sfx-rock.ogg',
      'audio/sfx-sling.ogg',
      'audio/sfx-water.ogg',
    ],
    note: 'Generated with PixelLab sound effects (owner choice, 2026-11-13); prompts and every job in prototypes/topdown/tools/sfx_pl.py and prototypes/topdown/ledger.json, untouched sources in audio/source/sfx/, trimmed, loudness-normalised and encoded to mono Ogg Vorbis. Output terms: https://pixellab.ai/termsofservice. No exclusive copyright in generated output is claimed.',
  },
];

export const CREDITS: readonly CreditEntry[] = [
  {
    what: 'The bending animation cels',
    work: 'Fire, water, earth and air effects, with lightning, ice, healing and metal',
    authors:
      'This project, generated with OpenAI image generation; the flask cels reuse the PixelLab flask prop',
    licence: 'own work',
    source: '',
    covers: ['art/fx'],
    note: 'Hand-drawn-style effect sheets generated for this project, normalised into 48 transparent animation cels, plus the reused PixelLab flask prop (docs/art/prop-family-v1.md, https://pixellab.ai/termsofservice). Prompts and provenance: docs/art/elemental-cels.md; docs/art/deserter-material-fx.md. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.',
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
    what: 'The title screen key art',
    work: 'Three title paintings: the Forest Road, the Ba Dan market and the bridge to the quarry gate',
    authors: 'This project, generated with OpenAI image generation',
    licence: 'own work',
    source: '',
    covers: ['art/title'],
    note: 'Rotating key art generated for this project from the approved portraits. Prompt summary, processing and pinned hashes: docs/art/title-key-art.md. Output terms: https://openai.com/policies/terms-of-use/. No exclusive copyright in generated output is claimed.',
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
    what: 'The Grumbler portrait',
    work: 'Quarry machine portrait',
    authors: 'This project, generated with OpenAI image generation',
    licence: 'own work',
    source: '',
    covers: ['art/portraits/enemy.grumbler.png'],
    note: 'Original quarry machine UI portrait. Prompt and processing notes: docs/art/grumbler.md. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.',
  },
  {
    what: 'The top-down figure sheets',
    work: 'Kaya, Sura, Bo, the forest bandits, the Ba Dan residents and the Driller, in the top-down style',
    authors: 'This project, generated with PixelLab',
    licence: 'own work',
    source: '',
    covers: ['art/topdown'],
    note: 'Characters made with PixelLab create-character-v3 and posed by its skeleton-v3 animations; the Driller is a PixelLab object with its own animations. Sources and every job’s credits in prototypes/topdown/ (assets/, ledger.json), packed without resampling by scripts/art/topdown/pack-sheets.ts. See docs/adr/0103-top-down-pixellab-direction.md and docs/adr/0104-top-down-port-plan.md. Output terms: https://pixellab.ai/termsofservice. No exclusive copyright in generated output is claimed.',
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
    what: 'The combat prop family',
    work: 'Water barrel, cabbage cart, brazier, quarry rubble, oil flask and hay bale',
    authors: 'This project, generated with PixelLab',
    licence: 'own work',
    source: '',
    covers: [
      'art/props/barrel.png',
      'art/props/cart.png',
      'art/props/brazier.png',
      'art/props/rubble.png',
      'art/props/flask.png',
      'art/props/hay.png',
    ],
    note: "One matched family of transparent combat props, first selected for the approved village and quarry art direction (docs/art/prop-family-v1.md), then redrawn at the characters' grain with PixelLab Pro Flash from that family (ADR 0087): every job, prompt and selection in art/source/forest-road-g1/. Output terms: https://pixellab.ai/termsofservice. No exclusive copyright in generated output is claimed.",
  },
  {
    what: 'The workers’ tea station',
    work: 'The workers’ tea station prop',
    authors: 'This project, generated with OpenAI image generation',
    licence: 'own work',
    source: '',
    covers: ['art/props/tea-station.png'],
    note: 'Original generated transparent prop, packed from the Act 1 environment work (docs/art/act1-environments.md) and documented in docs/art/tea-station.md. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.',
  },
  {
    what: 'The forest turtle-duck nest',
    work: 'Turtle-duck and duckling nest discovery illustration',
    authors: 'This project, generated with OpenAI image generation',
    licence: 'own work',
    source: '',
    covers: ['art/world/turtle-ducks-nest.webp'],
    note: 'Original transparent discovery illustration. Source image, exact prompt and resize provenance: assets/source/forest-nest/. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.',
  },
  {
    what: 'The forest road runoff waystone',
    work: 'Carved waystone discovery prop',
    authors: 'This project, generated with OpenAI image generation',
    licence: 'own work',
    source: '',
    covers: ['art/world/runoff-marker.png'],
    note: 'Original pixel-painted prop with a four-colour locked palette and binary alpha, replacing the drawn placeholder. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.',
  },
  {
    what: 'The Ba Dan wayside route sign',
    work: 'Painted wooden route sign prop',
    authors: 'This project, generated with OpenAI image generation',
    licence: 'own work',
    source: '',
    covers: ['art/world/route-sign.png'],
    note: 'Original pixel-painted prop with a compact indexed palette and binary alpha, replacing the drawn placeholder. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.',
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
