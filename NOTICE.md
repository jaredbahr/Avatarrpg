# Notice

Four Nations Tactics is non-commercial fan work. This file lists everything in
it that someone else made, what licence it arrives under, and where it came
from. The game shows the same list under Pause, Credits: both are generated
from `src/content/credits.ts`, so run `npm run credits` after changing it.

Anything not listed here was made for this project.

## Third-party work

| What                 | Work                                       | By                                  | Licence                   | Source                                             |
| -------------------- | ------------------------------------------ | ----------------------------------- | ------------------------- | -------------------------------------------------- |
| The heading typeface | Shippori Mincho 700, Latin subset          | The Shippori Mincho Project Authors | SIL Open Font License 1.1 | [link](https://github.com/fontdasu/ShipporiMincho) |
| The action icons     | Game Icons                                 | the Game Icons contributors         | CC BY 3.0                 | [link](https://github.com/game-icons/icons)        |
| The sound effects    | Impact Sounds 1.0 and Interface Sounds 1.0 | Kenney (kenney.nl)                  | CC0 1.0                   | [link](https://kenney.nl)                          |

These licences ask for the author to be named wherever the work is used,
which is why the game carries the same list on its own Credits screen:

- Shippori Mincho 700, Latin subset — The Shippori Mincho Project Authors
- Game Icons — the Game Icons contributors

Notes:

- **Shippori Mincho 700, Latin subset.** The licence travels with the font in public/fonts/OFL-ShipporiMincho.txt, as the OFL requires.
- **Game Icons.** One icon per kind of action, chosen in src/app/ui/icons.ts and built into a sprite by npm run art:icons. Each icon is by a named contributor; they are listed in the licence file at the source above.
- **Impact Sounds 1.0 and Interface Sounds 1.0.** Footsteps, impacts, splintering wood and the interface. These packs contain no bending sounds; those are generated (below) or rendered in the Web Audio graph from the description in src/content/sounds.ts.

## Made for this project

- **The bending animation cels.** Hand-drawn-style effect sheets generated for this project, normalised into 48 transparent animation cels, plus the reused PixelLab flask prop (docs/art/prop-family-v1.md, https://pixellab.ai/termsofservice). Prompts and provenance: docs/art/elemental-cels.md; docs/art/deserter-material-fx.md. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.
- **The illustrated story scenes.** Stationary cutscene paintings generated for this project. Prompts and provenance: docs/art/interludes.md. Output terms: https://openai.com/policies/terms-of-use/. No exclusive copyright in generated output is claimed.
- **The title screen key art.** Rotating key art generated for this project from the approved portraits. Prompt summary, processing and pinned hashes: docs/art/title-key-art.md. Output terms: https://openai.com/policies/terms-of-use/. No exclusive copyright in generated output is claimed.
- **The character art.** Generated from the project character references and prompt packs, then normalised and packed for the game. Dialogue portrait notes: docs/art/dialogue-portraits.md; bandit prompts: docs/art/bandit.md; remaining quarry bandits: docs/art/quarry-bandits.md; crossbow prompts and review: docs/art/crossbow.md; Cutting figures: docs/art/cutting-characters.md; fire deserter: docs/art/fire-deserter-runtime.md; hero walk prompts and review: docs/art/side-walks.md; Riko directional contact prompts, source provenance and reproducible packer: docs/art/prompts/sheets/unit.non.riko.md and docs/art/sources/riko-directional-contact/. Output terms: https://openai.com/policies/row-terms-of-use/. This credit does not claim exclusive copyright in generated output.
- **The Grumbler portrait.** Original quarry machine UI portrait. Prompt and processing notes: docs/art/grumbler.md. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.
- **The top-down figure sheets.** Characters made with PixelLab create-character-v3 and posed by its skeleton-v3 animations; the Driller is a PixelLab object with its own animations. Sources and every job’s credits in prototypes/topdown/ (assets/, ledger.json), packed without resampling by scripts/art/topdown/pack-sheets.ts. See docs/adr/0103-top-down-pixellab-direction.md and docs/adr/0104-top-down-port-plan.md. Output terms: https://pixellab.ai/termsofservice. No exclusive copyright in generated output is claimed.
- **The village NPC sprites.** Original full-body illustrations based on the approved dialogue portraits. Prompts, packing and shared archetype limitations: docs/art/npc-idles.md. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.
- **The riverside painting.** Original generated environment for the living-village prototype. Foreground silhouettes are composited at ground depth. Riverside hero walk and wave sheets are generated; animals and elemental effects are drawn by the game. See docs/art/riverside.md.
- **The combat prop family.** One matched family of transparent combat props, first selected for the approved village and quarry art direction (docs/art/prop-family-v1.md), then redrawn at the characters' grain with PixelLab Pro Flash from that family (ADR 0087): every job, prompt and selection in art/source/forest-road-g1/. Output terms: https://pixellab.ai/termsofservice. No exclusive copyright in generated output is claimed.
- **The workers’ tea station.** Original generated transparent prop, packed from the Act 1 environment work (docs/art/act1-environments.md) and documented in docs/art/tea-station.md. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.
- **The forest turtle duck nest.** Original transparent discovery illustration. Source image, exact prompt and resize provenance: assets/source/forest-nest/. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.
- **The forest road runoff waystone.** Original pixel-painted prop with a four-colour locked palette and binary alpha, replacing the drawn placeholder. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.
- **The Ba Dan wayside route sign.** Original pixel-painted prop with a compact indexed palette and binary alpha, replacing the drawn placeholder. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.
- **The bending and projectile sounds.** Generated with PixelLab sound effects (owner choice, 2026-11-13); prompts and every job in prototypes/topdown/tools/sfx_pl.py and prototypes/topdown/ledger.json, untouched sources in audio/source/sfx/, trimmed, loudness-normalised and encoded to mono Ogg Vorbis. Output terms: https://pixellab.ai/termsofservice. No exclusive copyright in generated output is claimed.
- **The app icons.** Drawn by scripts/make-icons.mjs.
- **The test art.** Flat colour stand-ins the end-to-end tests read back; never seen in play.
