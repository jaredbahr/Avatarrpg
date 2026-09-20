# Forest pond shoreline handoff

Owner: quarry composition agent. Integration: root. Base `9e005b1`.
Branch: `codex/forest-pond-shoreline`.
Worktree: `C:/Users/Jared/Documents/ChatGPT/Avatar RPG-forest-pond-shoreline`.
Runtime/art commit `3cdf125`; review approach correction `6a444e7`.
No push, CI, version change, renderer edit or rule change.

## Change and bounded acceptance

Replaced only `forest-scene/water.webp` and its ground-patch rectangle. The old
continuous dark rim was baked into that image; the underlying painted terrain
also has an exact water swatch plus a 0.08-cell guard. A narrow authored dry margin
now covers that guard, feathering to zero at 0.12 cells. Exact eight water cells,
walkability, permanent surface/source behavior, scene fallback and both renderer
contracts remain unchanged. Ground chunks, other props and actors are untouched.

Root reviewed matching 96px Canvas baseline/candidate and accepted removal of the
dark border as a bounded improvement. The exact cross silhouette remains; this
is **not** acceptance of a fully natural shoreline or the whole Forest Road view.
Source, exact prompt, credit and deterministic packing details are in
[forest-pond-shoreline.md](../../art/forest-pond-shoreline.md).

The pale oval present in both baseline and candidate is the cursor hover contour,
not pond art: `canvas2d.ts` HOVER_LOOP and hover fill (lines 47–48, 379–386), with
matching `pixi.ts` hover geometry (852–857). The pan ends with the pointer over
the pond. Its existing appearance was not changed.

## Checks and measured budget

- `npm run verify`: 819 tests / 93 files, typecheck, lint and formatting passed.
- `npm run build`, `npm run art:validate`, `npm run check:assets`: passed.
- Focused tests decode shipped alpha: no guard holes or exterior alpha leaks;
  no teal paint outside water before lossy encoding; every water-cell center area
  reads as water. Repacking produces identical WebP bytes.
- Water asset 33,408 bytes, down from 43,740. Maps 4,018,364 bytes / 4 MiB;
  total precache 17.19 MiB / 25 MiB. No budget or asset-format change.
- Final local review: 2 backend cases passed on clean `6a444e7` in 19.4 seconds.
  Final review-only correction changes approach coordinates; previous full verify
  was on `3cdf125`. Same production source, with no runtime changes between them.

## Actual gameplay evidence

All paths below are relative to this worktree. Baseline `.shots/pond-before`
is clean `9e005b1`; final `.shots/pond-after-approach` is clean `6a444e7`.
Each contains `canvas` and `webgl` directories, `source-build.png` and
`provenance.json`. Recorded cameras match exactly for all eight paired views
per backend. Viewport 1368 × 912, normal motion, strict port 4265.

Within each backend directory:

- `exploration-{64,96}-grid-{off,on}.png`
- `combat-{64,96}-grid-{off,on}.png`
- `staged-surfaces-{64,96}.png`: temporary ice/mud/steam remain visible.
- `accessibility-96.png`: high contrast and surface hatching.
- `missing-water-fallback-96.png`: deliberately blocked pond request invokes the
  existing whole-scene procedural fallback; this is functional, not visual parity.

The fixture uses seeded new games and existing `enterNode` setup, real wheel/pan
gestures and normal map taps. Ordinary approach positions (2,5), (3,6), (3,7)
were reached on both backends. A first attempt to walk directly to (5,6) stopped
at (4,5) because the real Into the Pines story interlude fired; that failed
review is retained in `.shots/pond-after`, not counted as accepted evidence.
The accepted review preserves the trigger. Temporary surfaces are explicit
gallery-style battle-grid fixtures, **not claimed legal cast sequences**.
No physical tablet review or new end-to-end story win is claimed here.

Reproduce with `FNT_REVIEW_BROWSER_CHANNEL=msedge` locally (PowerShell env syntax)
and `npx playwright test -c playwright.forest-pond.config.ts`. The config defaults
to bundled Chromium when that optional environment variable is absent, enforces
strict port 4265 and disallows reusing a listener. Playwright stopped its server
after the batch. Original rejected matte-fringe captures remain under
`.shots/pond-candidate`; corrected dirty candidates under `.shots/pond-candidate-v2`.
Use the final clean evidence for integration review.
