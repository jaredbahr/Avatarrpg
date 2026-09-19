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
- **Impact Sounds 1.0 and Interface Sounds 1.0.** Footsteps, impacts, splintering wood and the interface. The bending sounds are not here: these packs contain none, so an element’s voice is rendered in the Web Audio graph from the description in src/content/sounds.ts rather than played from a file.

## Made for this project

- **The bending animation cels.** Hand-drawn-style effect sheets generated for this project, normalised into 48 transparent animation cels. Prompts and provenance: docs/art/elemental-cels.md. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.
- **The illustrated story scenes.** Stationary cutscene paintings generated for this project. Prompts and provenance: docs/art/interludes.md. Output terms: https://openai.com/policies/terms-of-use/. No exclusive copyright in generated output is claimed.
- **The character art.** Generated from the project character references and prompt packs, then normalised and packed for the game. Dialogue portrait notes: docs/art/dialogue-portraits.md; bandit prompts: docs/art/bandit.md; remaining quarry bandits: docs/art/quarry-bandits.md; crossbow prompts and review: docs/art/crossbow.md; hero walk prompts and review: docs/art/side-walks.md. Output terms: https://openai.com/policies/row-terms-of-use/. This credit does not claim exclusive copyright in generated output.
- **The Grumbler artwork.** Original quarry machine artwork, generated and packed into nine transparent poses and a UI portrait. Prompts and processing notes: docs/art/grumbler.md. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.
- **The village NPC sprites.** Original full-body illustrations based on the approved dialogue portraits. Prompts, packing and shared archetype limitations: docs/art/npc-idles.md. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.
- **The riverside painting.** Original generated environment for the living-village prototype. Foreground silhouettes are composited at ground depth. Riverside hero walk and wave sheets are generated; animals and elemental effects are drawn by the game. See docs/art/riverside.md.
- **The Act 1 environments.** Original generated environments registered to the authored map layouts, with transparent props packed separately. Prompts and processing notes: docs/art/act1-environments.md; worn cart refresh: docs/art/quarry-gate-material-pass.md. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.
- **The layered Ba Dan courtyard.** Original generated material and scenery art, packed against the logical village map. Exact prompts, processing and registration: docs/art/ba-dan-scene.md and docs/art/ba-dan-scene-prompts.json. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.
- **The layered Forest Road.** Original generated art registered to the existing terrain without collision changes. Source IDs, prompts, masking and anchors: docs/art/forest-scene-registration.md. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.
- **The registered quarry gate art.** Original generated materials packed through authoritative map-cell masks, with separate transparent timber and wall pieces. The initial wholeplate was rejected for semantic drift. Prompts, provenance and repair notes: docs/art/quarry-gate-registration.md; weathered material refresh: docs/art/quarry-gate-material-pass.md. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.
- **The registered Cutting and Driller ground art.** Original generated full-scene ground sources and transparent rim candidates, measured and clipped to authoritative projected map geometry. Upright cliffs and live rules overlays remain separate. Provenance and registration: docs/art/cutting-driller-ground-registration.md, docs/art/exterior-quarry-rim-candidate-registration.md, and docs/coordination/handoffs/quarry-southwest-structure.md. Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated output is claimed.
- **The app icons.** Drawn by scripts/make-icons.mjs.
- **The test art.** Flat colour stand-ins the end-to-end tests read back; never seen in play.
