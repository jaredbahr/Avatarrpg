# Issue #341: G1 pixel overlays

**Updated:** 2026-10-30 UTC; owner `sol_renderer_finish`. Work remains local and unpublished.

## Outcome and bounds

Canvas 2D and Pixi share one bounded G1 raster source for talk pips, exits, move/target/area/hover contours, routes, aim cues, selected rings, target reticles, KO crosses and the decorative enemy health-bar spike. Their established palette, opacity, anchors, draw order, High Contrast rules and input meaning remain. Reduced motion holds talk and exit opacity steady. ADR 0100 records the shared source, integer-grid sampling and cache lifetime contract.

This branch adds no `GameState` field, art asset, new enemy-intent model, or #336 health-bar/acting-cue feature. The issue's “intent arrow” is the existing decorative enemy health-bar spike cap. It does not copy #322's texture-lifetime fix; its small Pixi cache extension passes retired G1 sources to the #322 trim helper.

## Location and coordination

- Worktree: `/workspace/avatarrpg-341-standalone`; branch: `codex/341-pixel-overlays-draft`.
- Current review stack: #322 source `3c305155` → temporary #336 source `6f44f9e7` → #341 local commits through `baef8398`, plus this handoff. Only the ignored `node_modules` symlink is untracked. Rebase unpublished #341 commits onto the corrected #336 source head before final validation. The final #341 PR must target the #336 branch so its diff contains only #341 overlays.
- Preserve `/workspace/avatarrpg-341`, `/workspace/avatarrpg-341-pixi` and `/workspace/avatarrpg-341-review` as source/evidence references. They include unrelated old batch changes and are not valid PR bases.
- #336 owns actor silhouette, health-bar fill and acting-cue geometry. #322 draft PR #360 owns general Pixi texture lifetime. No merge or deployment is authorized in this assignment.

## Source and verification

The shared helpers are `pixelMarks.ts`, `pixelMarkDrawables.ts`, `pixelMarkRendering.ts` and `pixelOverlayGeometry.ts`. Canvas and Pixi consume the same cue specs at their established draw passes. The pixel-source cache is bounded at 8 MiB / 256 idle drawable entries, the CPU raster cache at 1 MiB / 128 entries, and each source chunk at 256 × 256 G1 pixels. Active-frame and live-sprite sources are protected from eviction.

Focused `src/render/pixelOverlayGeometry.test.ts` passed 6 tests on the temporary stack, including reduced-motion opacity. Pre-existing focused raster/cache/backend checks were green before these new test changes; they must be rerun at final head. An earlier typecheck and targeted lint passed on the temporary stack before the latest small edits; the final exact-head checks are **not run**. A redundant typecheck was stopped under concurrent CI load; it is not a pass.

`e2e/pixel-overlay-rendering.spec.ts` now requests actual N1/N2/N3 camera zoom at DPR1/DPR2. Its staged scene captures before/after overlays, checks cross-backend rule signatures (including High Contrast), and renders each emitted cue through the production Canvas/Pixi adapter into an isolated transparent target. The final pixels must use authored alpha values and occupy whole G1-scaled device-pixel blocks. It also captures Ba Dan before/after talk/exit overlays, real forest movement before/after, KO crops, and a lifted quarry stair's DOM mouse hover and touch pick. **This expanded browser test has not run yet**, so visual/alpha/picking claims remain open until its recorded result and artifact review.

## Next actions

1. Receive the corrected #336 source head; rebase unpublished #341 commits and resolve only #341 overlay integration. Verify the final diff excludes #322/#336-owned features.
2. When the shared browser slot opens, run the focused Playwright spec and inspect its actual transparent-pixel/High Contrast/raised-pick results and captures. Fix concrete failures without relaxing assertions.
3. Review Ba Dan, forest and KO before/after PNGs; update this handoff with exact command, SHA, result, artifacts and limitations. Run all nine `npm run ci:local` checks on the exact final head before any push.
4. Open a draft #341 PR with base #336, no auto-merge. Obtain one actual branch CI run and record its target result. Do not call blocked acceptance complete.
