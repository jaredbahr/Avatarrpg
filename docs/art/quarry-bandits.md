# Remaining mandatory-route quarry bandits

Original slinger, bruiser and quarry stone-worker sheets and matching portraits
generated with the built-in OpenAI image-generation tool on 2026-09-18. Exact
generation and correction prompts are in `quarry-bandits-prompts.json`.
The existing bandit supplied ink/color style, not its identity or weapon.

- Slinger: lean hooded adult with a leather sling and stone pouch.
- Bruiser: broad adult, bald crown, rust forehead rag and heavy wooden club.
- Quarry stone-worker: lean adult, swept-back hair, green forehead rag/tunic, ochre
  sash and empty hands for stone techniques.

These follow the authored painter silhouettes. The first walking candidates
repeated a contact phase. Selected sheets instead use a contact and a distinct
passing step. The slinger's disconnected sling was regenerated as a coherent
overhead grip; its visible release cel holds the sling at the top of the swing.
The runtime still supplies the projectile at its original time. A final bruiser
background regeneration removed haze that prevented safe gutter splitting.

## Reproduction

Split each selected transparent 3-by-3 image with `splitGrid` from
`scripts/art/split-sheet.ts`. Row-major poses:

```text
idle/0 idle/1 walk/0
walk/1 cast/0 cast/1
cast/2 hit/0  ko/0
```

For `NAME` equal to slinger, bruiser or quarrybender, place cells under
`art/raw/unit.enemy.NAME/<pose>.png`, then run:

```sh
npm run art:normalise -- --unit unit.enemy.NAME --key alpha
npm run art:pack -- --unit unit.enemy.NAME
npm run art:portrait -- --key enemy.NAME --in <generated-portrait.png>
npx tsx scripts/art/optimise-png.ts public/art/portraits/enemy.NAME.png
```

Normalization preserves source alpha and uses one idle-derived scale for every
128-by-192 frame, keeping kneeling shorter. Portraits use the existing 512-square
parchment normalization. The lossless encoder searches PNG filters, compression
strategies and RGB encoding for opaque images, and checks every decoded RGBA
byte before writing. This also optimizes the existing thug and new crossbow
portraits without changing their appearance, keeping the combined Grumbler
portrait set below the existing 4 MB family budget.

## Integration and review

Existing clip rates, footprint, anchors, ability timings and sound cues remain
unchanged. Loading/failure falls back to each original bandit painter variant.
Portrait lookup uses the existing enemy-key convention. No rules, saves, asset
formats or budgets change.

Gallery beats `39-slinger`, `39-bruiser` and `39-quarrybender` stage movement,
action and inspector crops through Canvas and WebGL, plus portrait layout.
They are visual staging, not a claim that the enemy roster or combat rules were
exercised through player choices. Physical tablet and audible review remain
separate acceptance checks. Optional deserter, blade mercenary and sergeant
art remain outside this mandatory-route batch.

Output terms checked 2026-09-18:
<https://openai.com/policies/row-terms-of-use/>. No exclusive copyright in generated
output is claimed. The character-art credit covers both shipped directories.
