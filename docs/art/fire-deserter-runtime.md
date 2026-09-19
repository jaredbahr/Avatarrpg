# Fire deserter runtime integration

Base `8c91b74`, isolated branch `codex/fire-deserter-runtime`. This follow-up
integrates the original source checkpoint, replaces one walking contact's locked
arms with an opposed counter-swing, and supplies a matching original portrait.
Ruon and the party remain distinct people. Abilities, AI, damage, surface rules,
map geometry, camera, animation timing and renderer contracts are unchanged.

The nine-slot 1152 × 192 atlas keeps 128 × 192 frames, 128 pixels per tile,
one-cell footprint, mirrored facing and the (0.5,0.85) foot anchor. Standing
alpha height is 151px, or 75.5/113.25 screen pixels at 64/96 tile zoom. Walking
heights are 147/151px. Every frame's last occupied row is 162. Cast reach fits
with eight pixels of horizontal margin. The original fire-bandit caster painter
is retained for failed sheet loads.

The first runtime review exposed locked walking arms. Only `walk/1` now comes
from cell 3 of `assets/reference/fire-deserter/walk-counter-swing-source.png`.
`walk/0` still uses cell 1 of the prior source and its original scale. Decoded
RGBA comparison confirmed all eight other atlas cells are byte-identical to the
first runtime candidate. Exact edit prompt, generator identifier and selection
are in [fire-deserter-counter-swing-source.json](fire-deserter-counter-swing-source.json).
No bitmap pixels were painted, keyed or repaired by code.

The head in the sprite source was too small for a 512px portrait crop without
upscaling. A new original bust references that same source and matches its
cropped receding hair, mature clean-shaven face, red collar and brown strap.
Its exact prompt is in [fire-deserter-portrait-source.json](fire-deserter-portrait-source.json).
`portrait.enemy.deserter` uses the existing image and portrait fallback contract;
initiative and acting-unit panels discover the key without UI changes.

Reproduce the deterministic atlas and contacts:

```sh
node --import tsx scripts/art/fire-deserter.ts assets/reference/fire-deserter/combat-source.png .shots/deserter-counter-swing
```

Copy the resulting `package/deserter.png` and JSON to `public/art/units`.
Reproduce the 512px WebP portrait with
`node --import tsx scripts/art/fire-deserter-portrait.ts`. The portrait is
downsampled once and encoded at quality 90, using existing project tooling.
The original generator outputs remain preserved outside the precache.

The atlas adds 132,349 B (128,940 PNG + 3,409 JSON), bringing units to
4,835,087 B. [ADR 0035](../adr/0035-fire-deserter-art-budget.md) increases only
units from 4.5 to 4.75 MiB, with 145,649 B remaining. The portrait adds 20,546 B,
bringing portraits to 4,176,622 B, leaving 17,682 B within its unchanged 4 MiB
cap. Other families, total precache 25 MiB and JavaScript 300 KiB are unchanged.

## Runtime evidence and limits

`e2e/deserter.review.ts` uses the real gate roster and terrain, then explicitly
arranges actors and selects the deserter's turn in a test fixture. The unchanged
reducer accepts a move from (6,4) through (7,4) to (8,4), Oil Flask at Sura (5,4),
and Fire Blast at Sura. AP goes 4 → 2 → 0 and movement 4 → 2. The real returned
events feed the animator in one batch, as an AI turn does; no animation events,
legal ranges or abilities are fabricated. The fixture stops before AI resumes.
This is legal-action presentation evidence, not a claim of a complete manual run.

Run `npx playwright test --config playwright.deserter.config.ts`. The config uses
bundled Chromium by default, strict port 4265 and refuses an existing server.
Local review set `FNT_REVIEW_BROWSER_CHANNEL=msedge`. Each capture asserts the
visible build identifier, backend and actual zoom. Seed: `deserter-motion-review`.
Eight cases cover Canvas/WebGL × 64/96 × normal/reduced motion. The first matrix
is preserved under `.shots/deserter`; corrected gait and matching portrait are
under `.shots/deserter-counter-swing-runtime`, with source-build capture and
per-case `provenance.json` containing commands, results and sampled poses.

At 136/272ms the normal captures show opposite planted legs and arm swing. The
four walk samples have clip times selecting alternating contacts. Gather,
release, held release and recovery are captured for both legal attacks. Reduced
motion preserves final grounded idle and game results without a prolonged gait.
The corrected matrix passed all eight cases. The earlier forced-atlas-failure
matrix passed both backends at 96, preserved under `.shots/deserter-fallback`.
Its original fire-caster fallback is deliberately less illustrated than the asset.

The final failure check additionally aborts the portrait request. Both 96px
normal-motion cases pass with failed sheet and portrait loads, real movement and
actions, no page errors, and unchanged final AP; captures are preserved in
`.shots/deserter-final-fallback`. Exact normalized bounds and source hashes are
in [fire-deserter-runtime-measurements.json](fire-deserter-runtime-measurements.json).

Validation: full `npm run verify` passes 834 tests in 98 files; `art:validate`,
production build, asset budget and bundle budget pass. Precache contains all three
new public files and totals 17.37 MiB by the budget script (PWA manifest reports
157 entries / 17,755.30 KiB). Total JavaScript is 299.3 KiB gzipped of 300 KiB.
Repacking the atlas and portrait produces identical SHA256 hashes.

Known limitations remain: this is a simple two-contact mirrored walk, not a full
directional gait. Existing Oil Flask FX reads as a broad pale projectile, and Fire
Blast does not launch precisely from the new palm. Those separate FX contracts
were not changed. The gate's other bandit remains smaller than this adult figure.
This work makes no whole-route or all-enemy art acceptance claim.

Credits: original project art made with built-in OpenAI image generation;
generator outputs and exact prompts are retained. Existing credits and NOTICE
cover this atlas and portrait. No exclusive copyright is claimed.
