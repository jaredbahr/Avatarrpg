# Ba Dan at 1 px per world px: before and after (ADR 0090)

Canvas, 1368 x 912 at 1 dpr, N = 2 (128 px tiles) unless the file says otherwise. Before is the 1.5 px painting (on top, or
on the left); after is the 1 px re-cut. Captured with `e2e/ba-dan-demo.review.ts` (`FNT_DEMO_TILE_PX=128`) and
`e2e/ba-dan-village.review.ts` (`FNT_VILLAGE_MID_TILE_PX=128`; the wide frame is the N = 1 overview). Full frames are lossy
WebP q90; every `4x-*` and `demo-crop-*` file is lossless, 4x nearest of the N = 2 frame, so one art px is an 8 x 8 block.

- `slice-n2.webp`: the canal market slice. The party stands on the same cells in both runs (Kaya 8,8, Sura 7,8, Bo 6,8).
  In the after run the south-west house's see-through veil is on, so Bo and Sura show through its roof; before, it was off
  and Bo was hidden outright. Why (`veil-chimney.webp`): the veil fades a house to 0.28 when a figure behind it has its head
  (56 world px above the foot) under the house's silhouette, read from a 128 x 128 mask of the sprite. Bo's head point lies
  on the chimney's top edge, which is at world y 410.7 at 1.5 px and 411 at 1 px. The 1 px sprite's trimmed rectangle starts
  0.67 world px higher (404 against 404.67), so the point falls in mask row 2 (solid) instead of row 1 (empty). The upright,
  its alpha, its depth key and its rectangle on the painting are otherwise unchanged; `scripts/art/ba-dan-occlusion.test.ts`
  holds every upright's pixels over every figure behind it.
- `village-mid-west|centre|east.webp`: the whole village west to east at N = 2; `village-wide.webp` at N = 1.
- `4x-paving-and-bank`, `4x-roof-and-wall`, `4x-canopy-edge`: fixed boxes of the slice. `report.json` gives the share of
  2 x 2 device-pixel blocks that are one colour (one art px each at N = 2): 0.29 / 0.09 / 0.16 before, 0.86 / 1.00 / 1.00
  after. The rest is the lossy ground codec and figures.
- `demo-crop-*`: the demo spec's own 4x crops.
