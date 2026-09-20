# Quarry watch: Ruon reuse and deserter audit

Owner: quarry composition agent. Integration owner: root.
Branch `codex/quarry-watch-ruon`, base `db72f0b`, runtime/review commit `fad8e91`.
Worktree `C:/Users/Jared/Documents/ChatGPT/Avatar RPG-quarry-watch-ruon`.
No generation, new assets, budget change, push, CI or version change.

## Completed marker correction

`src/content/maps/world.ts` now uses existing `unit.ally.ruon` for the
`gate_parley` crossing marker. This is the only runtime edit. It retains
“The quarry watch,” visible position (8,5), the entire crossing area, once-only
condition and destination. Captain Ruon commands this watch in `gate_kinship`
and answers for it in `ruon_surrender`, so the existing portrait and later ally
sheet now have a coherent exploration identity.

No scale override is needed: his authored standing body is 151 pixels at
128 pixels per tile, scale 1. At 64/96 tile zoom this is 75.5/113.25 pixels,
matching the party's 121-pixel bodies at scale 1.25. The existing frame remains
139 × 192, anchor (0.5,0.85), logical footprint 1 × 1. Existing atlas, cache and
neutral mercenary-painter failure fallback are unchanged. Added asset bytes: zero.

Root reviewed paired Canvas96 frames and accepted this bounded improvement.
The generic talk pip remains at upper-chest level on this taller sheet. The
backend places it using the original one-tile marker formula rather than sheet
head bounds. This known presentation follow-up is not hidden or claimed fixed.

## Validation and actual evidence

- `npm run verify`: 822 tests / 94 files passed, including typecheck, lint and format.
- Focused world, marker scale and Cutting sheet checks: 23 tests passed.
- Before and clean-after review: two cases each, Canvas and WebGL; after passed
  in 11.2 seconds on `fad8e91`. No browser page errors.
- Actual ordinary taps (7,5), then (8,5), reach `gate_parley` and show “Walk up and
  knock.” No story conditions, encounter rosters or abilities were changed.

Evidence under this worktree:

- `.shots/watch-before/{canvas,webgl}`: clean `db72f0b`.
- `.shots/watch-after/{canvas,webgl}`: clean `fad8e91`.
- Each includes `source-build.png`, `watch-64.png`, `watch-96.png`,
  `watch-96-reduced.png`, `parley.png`, `provenance.json`.
- Recorded before/after cameras match exactly at both zooms. Viewport 1368 × 912.
  Reduced-motion capture is an idle still check, not new animation acceptance.

Setup uses the existing new-game/enter-node fixture, then sets the unvisited gate
approach at (5,5) and clears the escort objective. All subsequent zoom/pan and
approach use normal input. This tests gate interaction, not a fresh full-route win.
Reproduce with optional local `FNT_REVIEW_BROWSER_CHANNEL=msedge` and
`npx playwright test -c playwright.quarry-watch.config.ts`; default browser is
bundled Chromium. Strict port 4265, no listener reuse; server stopped after review.

## Separate Fire Nation Deserter: read-only findings

Ruon and the deserter are **different people**. `src/content/enemies.ts` defines
Ruon as a nonbender ally with `ruon_sabre` and `ruon_order`; the deserter is a fire
enemy with `fire_blast`, `oil_flask`, `torch_toss`. `src/content/story/act1.ts`
identifies Ruon as the local provincial guard captain; the fire bluff removes
the deserter while Ruon's surrender still follows. `src/content/encounters.ts`
spawns the deserter at (16,3) in the ordinary gate fight; its bluffed variant
replaces him with quarry crew. No Ruon enemy is in that encounter.

`src/content/assets/manifest.ts` still maps `unit.enemy.deserter` to
`painter('bandit', 'fire', 'bender')`. Ruon's source sheet was visually inspected
alongside his portrait: all three cast cels carry a sabre wind-up/cut/recovery.
They cannot be assigned to fire abilities. Kaya/Tenzo art supplies suitable
motion/style references, but directly reusing their full sheet would duplicate
a party member's identity. No compatible distinct illustrated deserter source
was found in the tracked art provenance.

Smallest future asset candidate: one original adult deserter sheet, restrained
Fire Nation red/brown clothing, distinct face and no sword. Nine genuine poses:
two idle, two opposed walk contacts, three unarmed gather/release/recovery,
one hit, one KO. Keep 128 pixels per tile, one-cell footprint and current anchor;
measure every pose to choose frame bounds and adult body size. A shared unarmed
forward-release gesture can support the present compact cast contract without
pretending a sword cut is fire. Distinct flask/torch held-item poses would require
an explicit ability-to-clip presentation decision, not aliasing a sabre frame.

Relevant future files: manifest; new `public/art/units/deserter.{png,json}`;
tracked source/provenance and packing script; credits/NOTICE; art tests; and
`src/render/painters/registry.ts` to explicitly preserve the existing bandit/bender
fallback when switching this key to a sheet. Enemy stats, abilities, encounter
and story identities need no edit. `src/app/anim/choreography.ts` currently uses
the common cast clip for all three ranged abilities, while `src/content/fx.ts`
provides distinct fireball, oil and torch recipes. These abilities retain the
existing ground-space FX source contract, rather than the calibrated palm path
used by Fire Jab/Water Whip/Air Blast. Any later hand-source calibration or
ability-specific pose selection must be scoped separately and preserve timing.

Budget planning only: base `db72f0b` units total 4,715,934 bytes, only 2,658 bytes
under 4.5 MiB. Existing compact illustrated packages suggest approximately
150–210 KiB for one adult nine-pose deserter; this is an estimate, not a measured
generated result or approved allocation. Wait for Riko's final packed total,
then remeasure family/precache and seek a narrowly justified ADR if necessary.
This marker correction consumes none of that shared headroom. No deserter art
or budget reservation has been started.
