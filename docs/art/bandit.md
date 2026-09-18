# Bandit art and weapon sound pass

The first illustrated enemy replaces `unit.enemy.thug` through the existing
sheet contract. `public/art/units/thug.png` and `thug.json` contain nine
128 x 192 frames: two idle, two walk, three cast, one hit and one kneeling
defeat. The existing melee fallback uses the cast sequence. Other enemy
silhouettes remain distinct painter assets; the bandit is not reused as a
slinger, bruiser or armoured mercenary.

## Art direction and provenance

Generated with the built-in OpenAI image-generation tool on 2026-09-18,
from the original character description in
`prompts/sheets/unit.enemy.thug.md`. The rust scarf, ragged vest, head-rag,
rope wraps and wooden club distinguish quarry bandits from the heroes and
the square-armoured mercenaries. Flat cel shading and warm dark-brown ink
follow the project's art bible. No canon character or costume was used.

[OpenAI output terms](https://openai.com/policies/row-terms-of-use/) were
checked on 2026-09-18. This is generated project artwork; no exclusive
copyright in generated output is claimed. Credits and NOTICE include it.
The exact reference, nine-pose sheet and walk-correction prompts are in
`bandit-prompts.json`.

A matching 512-pixel portrait in `public/art/portraits/enemy.thug.png` uses
the same reference and the `portrait` prompt in that file. The turn strip,
combat HUD and inspector share `portraitKeyFor`: a character's authored
portrait takes priority, then an explicitly registered portrait matching the
unit key (`unit.enemy.thug` -> `portrait.enemy.thug`), then the original sprite.
Enemies without portrait art retain their own silhouettes. This adds no
field to units, enemies, saves or the asset format.

The first walking candidate repeated the leading leg. The selected sheet
corrects the second contact pose, crossing the near leg in front with the
far foot trailing. Raw candidates remain in ignored `art/raw/`.

## Processing

`splitGrid` from `scripts/art/split-sheet.ts` splits the transparent 3 x 3
source at clear gutters. Row-major pose order is:

```text
idle/0  idle/1  walk/0
walk/1  cast/0  cast/1
cast/2  hit/0   ko/0
```

Cells are saved as `art/raw/unit.enemy.thug/<pose>.png`, then processed with:

```bash
npm run art:normalise -- --unit unit.enemy.thug --key alpha
npm run art:pack -- --unit unit.enemy.thug
npm run art:validate
```

One scale derived from idle applies to every frame; kneeling stays shorter.
Alpha is preserved, with no painted retouching or background replacement.
The common foot baseline and transparent frame margins follow the existing
contract. Enlarged grips, wrists, silhouette continuity and the packed atlas
were inspected. The `34-bandit-motion` gallery beat captures the actual sheet
walking and swinging in both production renderers. Physical tablet review
remains outstanding.

## Sound direction

`src/content/sounds.ts` now overrides the generic enemy voice for all thirteen
current weapon, machinery and ally technique keys. These are original seeded
Web Audio noise/filter recipes, not recordings or generated speech:

| Material / action | Sound shape                             |
| ----------------- | --------------------------------------- |
| Club              | Low, broad descending swish             |
| Sling             | Brief, higher leather-and-air release   |
| Rush              | Rising low movement rush                |
| Oil flask         | Short rounded liquid sweep              |
| Torch             | Fire-like descending rush               |
| Blade / sabre     | Two bright, short cutting sweeps        |
| Crossbow          | Mechanical crack with a very short tail |
| Driller slam      | Low, long weighty descent               |
| Oil spray         | Longer broad pressure hiss              |
| Debris            | Falling low stone sweep                 |
| Churn             | Rising granular low rumble              |
| Order             | Restrained rising support cue           |

Release cues do not add a body impact: the existing hit/miss timing remains
responsible for contact. The crossbow crack represents its mechanism.
Volume, gesture unlock, coalescing, seeded noise and the family fallback
remain unchanged. No audio download or precache bytes are added. These
recipes still need a listening pass on the target devices; automated checks
can establish scheduling and signal output, not subjective sound quality.

Validation for this pass: `npm run verify` passed all 578 tests;
`art:validate`, production build, bundle and asset budgets passed. The two
bandit filmstrips were inspected on Canvas and WebGL. Five targeted browser
audio/renderer checks passed (the software-renderer auto-selection check is
inapplicable on this GPU-equipped machine). An offline render through the
actual audio bus at Normal volume scheduled all thirteen cues, with finite,
nonzero signals and individual peak amplitudes between 0.024 and 0.162.
The local audition is `.shots/enemy-audio-preview.wav`, ordered as the table
above with separate blade and sabre cues; the accompanying JSON records exact
cue order and timestamps. This preview is not shipped or precached.
