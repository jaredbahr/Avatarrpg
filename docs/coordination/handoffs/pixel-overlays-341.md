# Issue #341: G1 pixel overlays

**Updated:** 2026-10-30 UTC; owner `sol_renderer_finish`. Work remains local and unpublished.

## Outcome and bounds

Canvas 2D and Pixi share one bounded G1 raster source for talk pips, exits, move/target/area/hover contours, routes, aim cues, selected rings, target reticles, KO crosses and the decorative enemy health-bar spike. Their established palette, opacity, anchors, draw order, High Contrast rules and input meaning remain. Reduced motion holds talk and exit opacity steady. ADR 0100 records the shared source, integer-grid sampling and cache lifetime contract.

This branch adds no `GameState` field, art asset, new enemy-intent model, or #336 health-bar/acting-cue feature. The issue's “intent arrow” is the existing decorative enemy health-bar spike cap. It does not copy #322's texture-lifetime fix; its small Pixi cache extension passes retired G1 sources to the #322 trim helper.

## Location and coordination

- Worktree: `/workspace/avatarrpg-341-standalone`; branch: `codex/341-pixel-overlays-draft`.
- Current review stack: #322 source `3c305155` → published draft #336 parent `72142ab36c551b55cd3ae8270b4503ce0d3832a1` → #341 unpublished local commits, current source/test head `1fcb8630a9b0d5a59a3c6460a5d7873f20fc3f75` before this handoff update. The #336 comparison source `694310a1` differs from its published head in a comment only, so its renderer behavior is the same. Only the local `node_modules` symlink is untracked apart from the evidence folder being prepared. The #341 PR must target the #336 branch so its diff contains only #341 overlays.
- Preserve `/workspace/avatarrpg-341`, `/workspace/avatarrpg-341-pixi` and `/workspace/avatarrpg-341-review` as source/evidence references. They include unrelated old batch changes and are not valid PR bases.
- #336 owns actor silhouette, health-bar fill and acting-cue geometry. #322 draft PR #360 owns general Pixi texture lifetime. No merge or deployment is authorized in this assignment.
- [Issue #341's sole claim/status comment](https://github.com/jaredbahr/Avatarrpg/issues/341#issuecomment-6524834424) records this session and is updated in place. No #341 PR or push exists yet.

## Source and verification

The shared helpers are `pixelMarks.ts`, `pixelMarkDrawables.ts`, `pixelMarkRendering.ts` and `pixelOverlayGeometry.ts`. Canvas and Pixi consume the same cue specs at their established draw passes. The pixel-source cache is bounded at 8 MiB / 256 idle drawable entries, the CPU raster cache at 1 MiB / 128 entries, and each source chunk at 256 × 256 G1 pixels. Active-frame and live-sprite sources are protected from eviction.

Five focused raster/cache/backend suites passed 23 tests on an earlier reviewed-parent source, including reduced-motion opacity. The corrected #336 baseline `694310a1` passed `npm run build` under activated Node 22.23.4 (20.97 s, exit 0; `/tmp/341-baseline-build-694310a1.log`). The #341 matched-frame producer `acdf8b07` passed its exact-head Node 22 build (21.37 s, exit 0; `/tmp/341-build-acdf8b07.log`). The later talk-crop fixture head `1fcb8630` passed `npm run typecheck`, touched-file lint/format and an exact-head production build (23.52 s, exit 0; `/tmp/341-typecheck-talk-fixture.log`, `/tmp/341-build-1fcb8630.log`). The product source and matched-pair fixture are byte-identical between `acdf8b07` and `1fcb8630`. Final #341 all-nine `npm run ci:local` checks have **not run**; all evidence and handoff edits must be committed before that exact-head gate and before any push.

`e2e/pixel-overlay-rendering.spec.ts` requests actual N1/N2/N3 camera zoom at DPR1/DPR2. Its staged scene captures overlay-on/off diagnostics, checks cross-backend rule signatures (including High Contrast), and renders each emitted cue through the production Canvas/Pixi adapter into an isolated transparent target. The final pixels must use authored alpha values and occupy whole G1-scaled device-pixel blocks. The raised quarry case uses real DOM mouse hover, drawn highlight and touchscreen pick on a lifted top.

The first four-case matrix at `acdf8b07` exited 1 after 14.4 minutes: two DPR parity cases failed at the fixture's zoom-3 talk crop, while both raised-input cases passed. The error contexts and exact log were preserved in `/tmp/341-matrix-acdf8b07-results` and `/tmp/341-matrix-acdf8b07.log`. Commit `1fcb8630` moved the staged speaker to a central road tile and measured the unchanged 40 px crop from the production NPC box and pip lift, asserting that the full marker fits onscreen. The next exact-head four-case matrix used a one-worker temporary config outside the repo, a fresh preview on port 4494, the installed Chromium, and the verified production build. It exited 1 after 14.6 minutes (`/tmp/341-matrix-1fcb8630.log`): DPR1 parity passed completely at N1/N2/N3 on both backends; DPR2 timed out at its existing 600-second limit inside a long staged Pixi capture before its pixel assertions; raised Canvas hover/touch passed; raised WebGL's `expect.poll` timed out without observing a wrong tile after the long software-WebGL batch. DPR2 alpha/parity and a fresh WebGL raised-input pass remain open. No threshold or gate was weakened.

`e2e/pixel-overlay-pairs.review.ts` captured matched Ba Dan, forest preview and KO Canvas frames against the exact #336 baseline `694310a1` and #341 app `acdf8b07`, each one-worker command exiting 0 with no page errors. The fixture waits for profiled Gao's authored figure instead of selecting the village route sign. The six [curated before/after PNGs and their SHA/provenance](../evidence/341/README.md) are staged for commit. These fixed `MapView` captures are renderer fixtures, not playthrough captures. WebGL matched-pair captures were not run; production WebGL is instead covered by the matrix, whose DPR2 gate remains blocked. The additional Ba Dan diagnostic in the matrix still chooses the first non-quiet marker and must not be presented as curated talk-figure evidence.

## Next actions

1. Resolve the DPR2 browser-duration blocker with a bounded test-workload change that preserves all production alpha/parity assertions; keep the 600-second timeout and explain any actual performance bottleneck. Run a fresh standalone WebGL raised-input case after #370 releases the GPU, retaining the existing hover/touch checks.
2. Review the resulting actual DPR2 and raised-top frames. Root has already accepted the prior raised-top Canvas/WebGL visual match on the lifted stair, and the corrected DPR1 talk pip is complete and centered on both backends; later runs must have their own recorded result.
3. Finish evidence/handoff, run scoped Prettier on changed Markdown, and commit all artifacts before the exact-head nine `npm run ci:local` checks. Verify the final diff excludes #322/#336-owned features.
4. Only after green exact-head local gates, push and open a **draft** #341 PR with base #336, no auto-merge. Obtain one actual branch CI run and record its target result. Do not call blocked acceptance complete.
