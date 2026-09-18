# Crossbow mercenary

Original crossbow combat sheet and matching portrait generated with the built-in
OpenAI image-generation tool on 2026-09-18. Exact prompts are in
`crossbow-prompts.json`. The bandit sheet supplied line/color style only; the
mercenary follows the existing lean, helmeted, square-armored painter identity
with charcoal trousers and a crossbow. It is not a reused bandit silhouette.

The first candidate repeated its walking contact. A targeted generation corrected
row 2 column 1 to put the other leg forward. The selected transparent 3-by-3 sheet
has row-major poses:

```text
idle/0 idle/1 walk/0
walk/1 cast/0 cast/1
cast/2 hit/0  ko/0
```

Split with `splitGrid(source, 3, 3)` from `scripts/art/split-sheet.ts`, save each
cell under `art/raw/unit.enemy.crossbow/<pose>.png`, then run:

```sh
npm run art:normalise -- --unit unit.enemy.crossbow --key alpha
npm run art:pack -- --unit unit.enemy.crossbow
npm run art:portrait -- --key enemy.crossbow --in <generated-portrait.png>
```

One scale from idle applies to every 128-by-192 frame; the kneeling figure stays
shorter. Source alpha is preserved. The existing one-tile footprint, baseline,
clip rates, crossbow ability and sound are unchanged. Loading/failure uses the
original crossbow mercenary painter. The matching portrait resolves through the
existing enemy portrait lookup. No save or asset-format change is needed.

The `38-crossbow-motion` and `38-crossbow-portrait` gallery beats exercise the
sheet and inspector through the production renderers. The staged motion beat is
visual review, not a claim of combat-rules acceptance. Physical device and audible
acceptance remain separate checks.

Output terms checked 2026-09-18:
<https://openai.com/policies/row-terms-of-use/>. No exclusive copyright in generated
output is claimed. The character-art credit covers both shipped directories.
