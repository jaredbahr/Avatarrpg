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
    note: 'Footsteps, impacts, splintering wood and the interface. The bending sounds are not here: these packs contain none, so an element’s voice is rendered in the Web Audio graph from the description in src/content/sounds.ts rather than played from a file.',
  },
  {
    what: 'The motion of the party’s knockouts',
    work: 'CMU Graphics Lab Motion Capture Database, subject 90 trial 18 and subject 77 trials 16 and 18',
    authors: 'Carnegie Mellon University Graphics Lab',
    licence: 'CMU Motion Capture Database terms',
    source: 'https://mocap.cs.cmu.edu',
    covers: [
      'art/units/kaya-g-3.webp',
      'art/units/kaya-g-3.json',
      'art/units/kaya-g-clips.json',
      'art/units/sura-g-3.webp',
      'art/units/sura-g-3.json',
      'art/units/sura-g-clips.json',
      'art/units/bo-g-3.webp',
      'art/units/bo-g-3.json',
      'art/units/bo-g-clips.json',
    ],
    note: 'The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217. Kaya falls to 90_18 (RugPullFall), frames 64 to 170; Sura to 77_18 and Bo to 77_16, each lying down played in reverse; every take is retargeted onto the character’s own stance; the cels are drawn for this project with PixelLab. See docs/adr/0059-g-knockout-and-thug.md.',
  },
  {
    what: 'The motion of the party’s hit reactions',
    work: 'CMU Graphics Lab Motion Capture Database, subject 79 trial 73, subject 76 trial 03 and subject 77 trial 09',
    authors: 'Carnegie Mellon University Graphics Lab',
    licence: 'CMU Motion Capture Database terms',
    source: 'https://mocap.cs.cmu.edu',
    covers: [
      'art/units/kaya-g-4.webp',
      'art/units/kaya-g-4.json',
      'art/units/sura-g-4.webp',
      'art/units/sura-g-4.json',
      'art/units/bo-g-4.webp',
      'art/units/bo-g-4.json',
    ],
    note: 'The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217. Kaya flinches to CMU 79_73 (scared), frames 48 to 72; Sura to CMU 76_03 (avoid attacker), frames 256 to 288; Bo to CMU 77_09 (duck to avoid flying object), frames 212 to 234; every take is retargeted onto the character’s own stance in each of eight headings; the cels are drawn for this project with PixelLab, and their clips ride in the same clip data as the knockouts. See docs/adr/0063-g-hit-reactions.md.',
  },
  {
    what: 'The motion of the thug’s and the quarry bandits’ walks',
    work: 'Mixamo “Unarmed Walk Forward”',
    authors: 'Adobe Mixamo',
    licence: 'Adobe Mixamo terms',
    source: 'https://www.mixamo.com',
    covers: [
      'art/units/thug-g.webp',
      'art/units/thug-g.json',
      'art/units/slinger-g.webp',
      'art/units/slinger-g.json',
      'art/units/bruiser-g.webp',
      'art/units/bruiser-g.json',
      'art/units/quarrybender-g.webp',
      'art/units/quarrybender-g.json',
    ],
    note: 'Projected onto each unit’s eight headings and root-locked; the cels are drawn for this project with PixelLab, and the idle and the cast, hit and defeat poses are this project’s own. The animation file itself is not redistributed. See docs/adr/0059-g-knockout-and-thug.md and docs/adr/0062-g-quarry-bandits.md.',
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
    what: 'The 2x2 Driller animation',
    work: 'Bronze quarry machine idle, walk, cast, hit and knockout animation',
    authors: 'This project, generated with PixelLab',
    licence: 'own work',
    source: '',
    covers: ['art/units/driller.webp', 'art/units/driller.json'],
    note: 'Generated with PixelLab; provenance in docs/art/driller-2x2.md; sources in media/art-sources/driller-2x2-v1/, packed without resampling by scripts/art/driller-2x2.ts. Output terms: https://pixellab.ai/termsofservice. No exclusive copyright in generated output is claimed.',
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
    note: 'One matched family of transparent combat props, selected and packed for the approved village and quarry art direction. PixelLab review object IDs, shared prompt, per-item prompt lines, processing and scale: docs/art/prop-family-v1.md. Output terms: https://pixellab.ai/termsofservice. No exclusive copyright in generated output is claimed.',
  },
  {
    what: 'The Act 1 environments',
    work: 'Five map paintings and the workers’ tea station',
    authors: 'This project, generated with OpenAI image generation',
    licence: 'own work',
    source: '',
    covers: [
      'art/maps/ba_dan_village.webp',
      'art/maps/forest_road.webp',
      'art/maps/quarry_gate.webp',
      'art/maps/ambush_road.webp',
      'art/maps/quarry_floor.webp',
      'art/props/tea-station.png',
    ],
    note: 'Original generated environments registered to the authored map layouts, with the transparent workers’ tea station packed separately. Prompts and processing notes: docs/art/act1-environments.md; workers’ tea station: docs/art/tea-station.md. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.',
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
    what: 'The forest turtle-duck nest',
    work: 'Turtle-duck and duckling nest discovery illustration',
    authors: 'This project, generated with OpenAI image generation',
    licence: 'own work',
    source: '',
    covers: ['art/world/turtle-ducks-nest.webp'],
    note: 'Original transparent discovery illustration. Source image, exact prompt and resize provenance: assets/source/forest-nest/. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.',
  },
  {
    what: 'The forest flood-bank nest reeds',
    work: 'Low washed-up reeds and an empty silted nest scenery prop',
    authors: 'This project, generated with OpenAI image generation',
    licence: 'own work',
    source: '',
    covers: ['art/maps/forest-scene/old-nest-reeds.webp'],
    note: 'Original transparent passable scenery. Source image, exact prompt and resize provenance: assets/source/forest-bank/. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.',
  },
  {
    what: 'The forest pond and creek bank reeds',
    work: 'Four varied reed, sedge and water-edge clumps with painted root mounds',
    authors: 'This project, generated with PixelLab',
    licence: 'own work',
    source: '',
    covers: [
      'art/maps/forest-scene/bank-reed-0.webp',
      'art/maps/forest-scene/bank-reed-1.webp',
      'art/maps/forest-scene/bank-reed-2.webp',
      'art/maps/forest-scene/bank-reed-3.webp',
    ],
    note: 'Generated with PixelLab; provenance in docs/art/forest-bank-reeds.md; sources in media/art-sources/forest-bank-reeds-v1/, alpha-trimmed without resampling by scripts/art/forest-bank-reeds.ts. No exclusive copyright in generated output is claimed.',
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
