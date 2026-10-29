# Issue #341: G1 pixel overlays

## Scope and ownership

The Canvas adapter, shared geometry/cache helpers, tests, ADR 0100 and this handoff are owned by `codex/fix-341-pixel-overlays` in `/workspace/avatarrpg-341`. The Pixi adapter is a separate, scoped commit from `renderer_fix_review`; the visual capture harness is owned by `readability_queue_triage` in its isolated review worktree. Root integrates the returned commits. The earlier `501e704f` #336 dependency is already in root's tree and must not be returned as a new #341 change. The build version remains 0.2.12.

## Cue inventory and draw order

- Move, target and area/range contours use shared rounded loops; High contrast keeps square tile-set contours. Hover uses the same mask path, while its calm-path marker remains an outline.
- Route dots, route line/underlay, endpoint arrow or calm marker, and aim arc/dots/arrow use shared projected G1 geometry. Route semantics and endpoints are unchanged; the dash source phase is stable to keep raster keys reusable.
- Exits use the shared ring and right-facing chevron at the existing tile center and pulse alpha.
- Talk pips retain their resident anchor from `npcPipLift`, actor alpha and pulse, and remain after the NPC body.
- The exploration selection ellipse is hollow and remains in the existing under-actor ground-ring pass. The #336 combat active frame remains as-is.
- Elevation and obscured target marks keep their meanings and foreground placement. A non-null clear/same-height reticle has no mark and is explicitly skipped.
- Fallen actors keep the red KO cross after their body. Only the enemy health-bar spike cap is converted, from the exact existing `healthBarCap` polygon points; all bar frame/fill, ally diamond and active-unit geometry remain unchanged.

No separate enemy-intent arrow or state was added. The demo audit's enemy arrow refers to the existing enemy cap polygon. Climb labels, cliff cues, obscuration veils, status badges and floating numbers are outside this G1 mark scope.

## Shared mask and lifetime contract

ADR 0100 is the rendering contract. Masks are flat RGBA, one source texel per projected world pixel, with integer anchors, hard alpha and one- or two-pixel strokes. Whole-pixel camera stops sample nearest; fractional overview keeps existing linear sampling. The helper has no camera, canvas, clock or random dependency.

Large marks use source-grid-aligned chunks no larger than 256 px on a side. Chunk rectangles are disjoint at the destination; a pixel is composited once, and line phase continues across boundaries. A pan changes only the visible chunk selection, not interior chunk keys.

- CPU raster LRU: 1 MiB / 128 entries.
- Idle Canvas/Pixi drawable sources: 8 MiB / 256 entries. Visible frame sources are protected and may temporarily exceed the idle limits.
- Pixi source texture wrappers: 128 total, with live sprite references protected. Pixel-mark textures are retired after stage rendering only when no stage sprite or offstage shadow-mask sprite references their `TextureSource`; unused pooled sprites detach first. Pixel-mark GPU source bytes track the drawable idle budget, except for the active-frame allowance.

## Commits to integrate

- `97f54baa` — pure bounded G1 rasterizer.
- `3d8ca6be` — talk cues on G1 raster sources.
- `2ff61ac7` — anchored marks use local bounds for visibility.
- `0035a8a4` — shared overlay geometry, projection handling and raised-top culling.
- `01eebd27` — idle drawable cache entry cap and regression.
- `2c4bfb27` — Canvas overlay, actor and enemy spike adapter.
- The Pixi renderer returns its own adapter-only commit; integrate it after confirmation from `renderer_fix_review`.

Root has already integrated the shared helper checkpoints through `0035a8a4` at `e3dc175e`; it will integrate `01eebd27` and `2c4bfb27` separately. Do not cherry-pick duplicate commits.

## Focused checks and review captures

After the final source change, `tsc`, ESLint on touched source/tests, and these focused suites passed:

```sh
npx vitest run \
  src/render/pixelMarkDrawables.test.ts \
  src/render/pixelMarks.test.ts \
  src/render/pixelMarkRendering.test.ts \
  src/render/pixelOverlayGeometry.test.ts
```

The 18 tests cover hard palette/alpha, integer geometry bounds, local-anchor culling and stable source identity, shaken/raised viewport reach, large contour and line chunk parity, seam compositing, CPU/drawable bounds, repeated-frame cache reuse, route/aim arrow direction in both projections, and combined elevation/cloud reticles in both directions.

The dedicated Playwright capture task is still running in `/workspace/avatarrpg-341-review`; its owner will append the exact commands, Canvas/WebGL N1/N2 × DPR1/DPR2 artifact paths, source/raster counts before and after warm frames/pan, route/target timing, mark-source crop comparison, actor-overlap result, errors and limitations here. Do not claim unrun capture coverage or a full CI result. The captured page uses the actual camera scale 1 and 2 at each DPR; DPR alone does not substitute for the zoom test.
