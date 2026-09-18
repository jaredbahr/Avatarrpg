# Hero side walks

Every playable hero has a four-cel lateral walk loop in
`public/art/units/walking-{name}.{png,json}`. The manifest resolves `walk`
directly instead of displaying a stationary idle during east/west travel.
The existing animator supplies distance-based cadence and westward mirroring.

Kaya and Sura reuse their four riverside walk cels. The other eight sheets were
generated with the built-in OpenAI image tool, using the established full-body
sheet and portrait as identity references. Exact accepted prompts and source
filenames are in [`side-walk-prompts.json`](side-walk-prompts.json). The pose
guide in `assets/reference/pose-guides/side-walk.png` is an original vector
diagram: blue is the near arm/leg, orange the far arm/leg. These colors and the
guide background are not part of the shipped art. Wen's accepted variation
braces his heavy gauntlet across the waist while the legs move; rejected
variants switched the gauntlet's arm or produced an extra arm and are not used.

Other rejected drafts repeated the same arm/contact poses. The accepted set
uses relaxed closed or partially occluded hands, matching hair, face, costume
and accessories, without elemental effects or ground shadows. Bo remains
clean-shaven. PR #43's portrait hand corrections do not alter these identity
regions and are preserved independently.

## Packing

```bash
node --import tsx scripts/art/side-walk.ts bo art/raw/side-walks/bo-v2.png
node --import tsx scripts/art/side-walk.ts kaya
node --import tsx scripts/art/side-walk.ts sura
npm run art:validate
```

The importer accepts a transparent 2×2 grid in row order. It trims transparent
space, applies one common scale per character, aligns feet to y=162, and packs
128×192 frames with the existing 0.5/0.85 anchor. Source alpha is retained.
It rejects empty cells, excessive height drift, upscaling or inadequate margins.
All sixteen prior combat and north/south cels are copied pixel-for-pixel from
the archived directional sheet. Nothing changes gameplay, saved positions,
navigation, collision or the renderer contract.

Reference sheets moved from `public/art/units/` to
`assets/reference/character-poses/` and `assets/reference/character-locomotion/`.
They remain in Git for future art work. Historical prompt packs still describe
the original six-pose intake; use this pipeline for updates to active heroes.

## Review evidence

- `side-walk.test.ts` checks every prior cel byte-for-byte, four distinct new
  cels per hero, exact walk resolution, playback looping, margins and footing.
- `directional-motion.test.ts` continues checking original action poses and
  front/back scale and foot anchors.
- Gallery beat `35-hero-walk-cels` shows all ten heroes at approximately 40 px
  figure height, then enlarged, with all four east and mirrored west frames.
- Gallery beats `35-hero-walk-{1,2}-{east,west}` play both five-member groups
  through the production animator and capture four walk phases plus settled
  idle on Canvas and WebGL. These are staged art reviews, not route playthroughs.
- Unit art is 2.86 MB of its unchanged 4 MB budget. Total precache is 10.83 MB
  of 25 MB, smaller than before because inactive reference sheets no longer ship.

Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive
copyright in generated output is claimed.
