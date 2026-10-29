# Issue #341: G1 pixel overlays

## Scope and ownership

The Canvas adapter and shared helpers were authored in `codex/fix-341-pixel-overlays` under `/workspace/avatarrpg-341`. The difficult Pixi adapter was authored separately by Sol High in `renderer_fix_review` and integrated from its original commit `92b5b021`. Root owns the integrated code, ADR, handoff and release metadata. Luna High owns only the final visual regression harness and captures in `/workspace/avatarrpg-341-review`, continuing the earlier `readability_queue_triage` checkpoint. The #336 dependency `501e704f` is already integrated; do not return it as a new change. The build version remains 0.2.12.

## Cue inventory and draw order

- Move, target and area/range contours use shared rounded loops; High contrast keeps square tile-set contours. Hover uses the same mask path, while its calm-path marker remains an outline.
- Route dots, route line/underlay, endpoint arrow or calm marker, and aim arc/dots/arrow use shared projected G1 geometry. Route semantics and endpoints are unchanged; the dash source phase is stable to keep raster keys reusable.
- Exits use the shared ring and right-facing chevron at the existing tile center and pulse alpha.
- Talk pips retain their resident anchor from `npcPipLift`, actor alpha and pulse, and remain after the NPC body.
- The exploration selection ellipse is hollow and remains in the existing under-actor ground-ring pass. The #336 combat active frame remains as-is.
- Elevation and obscured target marks keep their meanings and foreground placement. A non-null clear/same-height reticle has no mark and is explicitly skipped.
- Fallen actors keep the red KO cross after their body. Only the enemy health-bar spike cap is converted, from the existing `healthBarCap` polygon points; its local vertices snap relative to the cap midpoint so camera pans move the placement anchor without changing the raster source. All bar frame/fill, ally diamond and active-unit geometry remain unchanged.

No separate enemy-intent arrow or state was added. The demo audit's enemy arrow refers to the existing enemy cap polygon. Climb labels, cliff cues, obscuration veils, status badges and floating numbers are outside this G1 mark scope.

## Shared mask and lifetime contract

ADR 0100 is the rendering contract. Masks are flat RGBA, one source texel per projected world pixel, with integer anchors, hard alpha and one- or two-pixel strokes. Whole-pixel camera stops sample nearest; fractional overview keeps existing linear sampling. The helper has no camera, canvas, clock or random dependency.

Large marks use source-grid-aligned chunks no larger than 256 px on a side. Chunk rectangles are disjoint at the destination; a pixel is composited once, and line phase continues across boundaries. A pan changes only the visible chunk selection, not interior chunk keys.

- CPU raster LRU: 1 MiB / 128 entries.
- Idle Canvas/Pixi drawable sources: 8 MiB / 256 entries. Visible frame sources are protected and may temporarily exceed the idle limits.
- Pixi source texture wrappers: 128 total, with live sprite references protected. Pixel-mark textures are retired after stage rendering only when no stage sprite or offstage shadow-mask sprite references their `TextureSource`; unused pooled sprites detach first. Pixel-mark GPU source bytes track the drawable idle budget, except for the active-frame allowance.

## Source checkpoints

- `97f54baa` — pure bounded G1 rasterizer.
- `3d8ca6be` — talk cues on G1 raster sources.
- `2ff61ac7` — anchored marks use local bounds for visibility.
- `0035a8a4` — shared overlay geometry, projection handling and raised-top culling.
- `01eebd27` — idle drawable cache entry cap and regression.
- `2c4bfb27` — Canvas overlay, actor and enemy spike adapter.
- `fbae88e0` — Pixi overlay, actor and enemy spike adapter (reviewer's source commit `92b5b021`).
- `6f2ed8c0` — isolated Pixi-only enemy spike normalization follow-up; the N2 snapped vertices now match Canvas.
- `c3eab59f` — snap local spike vertices relative to the movable midpoint anchor in the shared helper and Canvas caller.
- `4fb2e48d` — matching Pixi raw local-offset caller.

Root integrated the unique source commits above through `61f04c91`, using Sol's original `92b5b021` instead of its duplicate `fbae88e0` cherry-pick. The #336 dependency and Sol's copies of shared-helper/Canvas commits were excluded. Root now owns the final handoff, metadata and combined gate; the isolated review worker owns its test-only commit and captures.

## Focused checks and review captures

After the final source change, `tsc`, ESLint on touched source/tests, and these focused suites passed:

```sh
npx vitest run \
  src/render/pixelMarkDrawables.test.ts \
  src/render/pixelMarks.test.ts \
  src/render/pixelMarkRendering.test.ts \
  src/render/pixelOverlayGeometry.test.ts
```

The 19 helper tests cover hard palette/alpha, integer geometry bounds, local-anchor culling and stable source identity, shaken/raised viewport reach, large contour and line chunk parity, seam compositing, CPU/drawable bounds, repeated-frame cache reuse, route/aim arrow direction in both projections, combined elevation/cloud reticles in both directions, and local spike snapping. The last cap fix also passed typecheck/lint and a numeric check through the actual camera/actor/bar helpers: Canvas and Pixi produce one identical raster key at scale 2, DPR 1/2 and Y pan 0/1 CSS px. Existing bar-anchor rounding can still move a cap's placement by one G1 pixel; that is separate from the corrected source geometry.

The final matrix passed in `/workspace/avatarrpg-341-review` with test-only revision `b7720228d18cdabf7d94158e5fc7ebe32563aed9` (root copy `3f0fb69e`). Its `src` tree is `31a2f262cd67452fa9a69576e9d568ff1163fe3b`, identical to the integrated product source. Activated command:

```sh
npx playwright test \
  --config /workspace/avatarrpg-env/playwright-341-review.config.ts \
  --project=surface-touch --grep 'backend parity at DPR'
```

Both cases passed in 6.2 minutes: DPR 1 took 1.4 minutes and DPR 2 took 4.3 minutes. Each covers Canvas and forced WebGL at actual camera scales 1 and 2: eight backend/zoom/DPR combinations. The authoritative log is `/workspace/avatarrpg-env/pixel-matrix-final4.log`. Static typecheck, targeted ESLint and Prettier also passed. The final commit changes assertion text only after this run, from “9 px diameter” to “radius-4 circle”; assertion behavior is identical.

Ignored captures are under `.shots/pixel-overlay-review/`: `gameplay-{canvas,webgl}-dpr{1,2}-move-{preview,confirmed}.png` and `mark-{canvas,webgl}-dpr{1,2}-zoom{1,2}-{cue}.png`. Root inspected normal WebGL Move preview, N2 target/selection and the corrected complete talk pip; earlier Canvas review covered the same normal gameplay flow. No new runtime defect was found in that visual review.

The matrix asserts identical cumulative raster counts after warm, repeat and one-CSS-pixel Y pan, plus enemy-spike key and actual drawable-object reuse. Its default reporter did not retain the absolute annotation values. An earlier source-equivalent N2/DPR1 diagnostic (`smoke-aim-diagnostics.json` in that capture directory) retained these illustrative figures:

| Backend | Raster count: warm / repeat / pan | Retained entries / bytes | Warm / repeat synchronous draw call |
| ------- | --------------------------------- | ------------------------ | ----------------------------------- |
| Canvas  | 36 / 36 / 36                      | 36 / 2,127,032           | 15.6 / 17.9 ms                      |
| Pixi    | 21 / 21 / 21                      | 21 / 405,828             | 5.0 / 1.7 ms                        |

Both reused the spike drawable on repeat and pan. Those earlier figures are not final-matrix absolute totals or GPU-frame latency measurements. The full matrix establishes the reuse invariants; physical-device performance, WebKit, audio and final aesthetic acceptance remain outside these local Chromium captures. Final combined local CI/browser/gallery evidence must name the clean root commit; this worker result does not establish a root-HEAD or remote CI run.

The per-cue fixture keeps identical actor poses and hides unrelated health bars so health-bar stagger history cannot contaminate a mark comparison. It derives emitted cue bounds before framing; talk pips use head-centered crops with explicit complete-circle and crop-edge assertions. The no-sign reticle uses the same observed position as its baseline. Pixel comparisons require nonempty masks and 98% mutual coverage within one G1 pixel, scaled by actual camera zoom and DPR. A separate opaque actor-interior control verifies that movement masks stay underneath actors. Real Move preview and Confirm captures use normal gameplay rather than the staged cue view.

Independent Sol High review of `61f04c91` found no actionable production defect in the bounded source-lifetime/transform review. It checked live frame protection, stage and offstage-shadow references, resize detachment, stable chunk identities under pan and raised-copy clipping. This was a read-only review, not an additional runtime or device test.
