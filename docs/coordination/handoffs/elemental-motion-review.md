# Elemental motion review and water material correction

2026-09-19. Owner: quarry-composition subagent; final integration: root.
Branch `codex/element-motion-review`, isolated `Avatar RPG-element-motion-review`.
Runtime baseline `cda0925`; parent cache-ignore fix `003e49b` was cherry-picked
as `ad36628` after captures (tooling only).

## Verified findings and change

Five-path baseline: Kaya Fire Jab, Sura Water Whip, Bo Rock Throw, Nima Air
Blast and Riko Strike. Fire gathers at the hand and strikes the torso; earth
visibly lifts before flight; air pressure coincides with its shove. Strike has
body contact feedback, although the shared side-facing attack pose cannot
literally reach every projected adjacent target. Those assets were unchanged.

Water Whip's smooth cyan crescent and continuous highlight read as a rigid blade.
Its correct hand attachment, torso contact and held return were preserved. Shared
water whip geometry now has a small continuous travelling ripple, three broken
highlights and three restrained beads. The family recipe is narrower and omits
the heavy procedural outline. Its four-cel impact remains unchanged. The Sura
waterskin head is larger and has a short seven-bead light trail; every source
particle dies before release. Source readability improves, but the short gather
still limits how clearly a player can identify the pouch at 64px. No source is
invented for Nilak.

Scope includes base/accent water whip geometry used by Pull and Octopus. Their
existing ink flags remain; focused tests cover finite bounded geometry and
zero-length aims. The dark metal cable keeps its original single taut arc.
No backend, asset format, sprite, camera, surface or timing-rule changes. Both
backends use the same deterministic age-sampled geometry. No image generation.

## Capture provenance

All accepted captures are under the isolated worktree's `.shots/motion/`:

- `verified-before-96/{canvas,webgl}-{kaya,sura,bo,nima,riko}`: ten cases.
- `verified-before-64/{canvas,webgl}-sura`: Water Whip at 64px.
- `after-final-96/{canvas,webgl}-sura` and `after-final-64/{canvas,webgl}-sura`:
  final implementation, including source trail.
- `after-reduced-64/{canvas,webgl}-sura`: reduced-motion smoke check.

Each case retains preview, sixteen full-page PNG samples, metadata with commands,
actual events, poses, emitters and camera. Contact sheets are technical crops of
those samples in row-major order, 1ms then 100ms increments through 1501ms after
Confirm. Original screenshot scale is retained in full-page PNGs. These are
sampled presentation fixtures, not a normal campaign, real-time video or device
performance/audio acceptance.

Chromium installed Chrome, 1672x941, blocked service workers. Existing repository
newGame/enterNode helpers stage solo Forest Road with seed `focus-bruiser-5`.
Only legal movement/end-turn commands then actual ability/Focus/target/Confirm UI
are used. No unit, map, RNG or animation-state mutation. Browser clock is installed
before app startup and paused only at the final preview. Actual camera is 96px
or 63.99999934px, obtained by ordinary wheel input. Natural first-cast damage is
Kaya7, Sura6, Bo5, Nima2, Riko6 on both backends. Errors empty, SW controller null.

Vite4237 starts from this isolated worktree with strictPort and
reuseExistingServer:false. Before every case the title must exactly match
`Game version 0.2.1, build cda0925` (before) or `cda0925-modified` (after).
Listener PID51896 was independently read with its full command pointing to this
worktree and4237. Later runs receive new PIDs but retain fail-closed title/port
checks. Harness/config/contact assembler are preserved in `.shots/motion/`.

Earlier4225 footage is NOT accepted source evidence: an audio task reused that
port. Top-level `{canvas,webgl}-*`, `before-96` and `after-96` are superseded; only
listed verified-before and after-final paths establish this review. An initial
64px attempt actually yielded42.7px; it was replaced by the measured64px baseline.

## Validation

Focused tests protect exact hand/contact endpoints in four directions, unchanged
out/return extent, deterministic smooth sampling, finite zero-length behavior,
shared Pull/Octopus bounds, taut cable, and source particles ending before release.
Existing choreography/attack-motion timing tests remain in place. Final full
verify/build results are recorded in the delivery handoff.

Reproduce with `npx playwright test -c .shots/motion/playwright.config.ts`;
`--grep sura` selects water. Set REVIEW_BUILD to the exact expected revision,
REVIEW_PHASE to a separate evidence prefix, REVIEW_SCALE=64 for64px, and
REVIEW_REDUCED=1 for reduced motion. Do not reuse another task's server.

Final checks: `npm run verify` passed804 tests in89files, typecheck, lint and
format; production build and `npm run check:assets` passed. JS gzip297.61kB,
precache16.70MiB/25MiB; no new assets. Existing900kB uncompressed chunk warning
remains. Reduced-motion browser samples contain zero emitters and no errors on
both renderers. All owned preview servers terminate with their Playwright run.
No push, PR or CI run was started. Root retains integration and release ownership.
