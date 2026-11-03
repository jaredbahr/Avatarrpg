# Forest road uprights at 1 px per world px: before and after (ADR 0090)

Canvas, 1368 x 912 at 1 dpr, from `e2e/forest-g1.review.ts` with `FNT_FOREST_G1_ZOOM=128` (N = 2; the files keep the spec's
`zoom96` names as `n2-*`). Before (on top, or on the left) is the uprights at 1.5 px; after is 1 px. `fit.webp` is the whole-board
overview (under one device px per world px, smoothed by design). Full frames are lossy WebP q90; `4x-*` and `crop-*` are lossless.

- `4x-lodge-roof`: one-colour 2 x 2 blocks 0.06 before, 1.00 after (`report.json`).
- `4x-pine-boughs`: 0.08 and 0.03. The pines sway in the wind, a skewed draw, which ADR 0088 smooths on purpose; they are
  crisp when still (reduce motion).
- `4x-signpost`: a combat prop, unchanged (0.61 and 0.64; ground behind it).
- `crop-*`: the spec's own 4x crops, mostly ground (already 1 px before).
