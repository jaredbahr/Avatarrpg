# Ba Dan at 1 px per world px: before and after (ADR 0090)

Canvas, 1368 x 912 at 1 dpr, N = 2 (128 px tiles) unless the file says otherwise. Before is the 1.5 px painting (on top, or
on the left); after is the 1 px re-cut. Captured with `e2e/ba-dan-demo.review.ts` (`FNT_DEMO_TILE_PX=128`) and
`e2e/ba-dan-village.review.ts` (`FNT_VILLAGE_MID_TILE_PX=128`; the wide frame is the N = 1 overview). Full frames are lossy
WebP q90; every `4x-*` and `demo-crop-*` file is lossless, 4x nearest of the N = 2 frame, so one art px is an 8 x 8 block.

- `slice-n2.webp`: the canal market slice. The party's followers trail for a moment after the leader is placed, so they
  stand at slightly different spots in the two runs; in the after run Sura's head is under the south-west roof line and the
  roof's designed see-through veil shows her (the roof's silhouette mask is the same to within 12 of 4,096 veil cells).
- `village-mid-west|centre|east.webp`: the whole village west to east at N = 2; `village-wide.webp` at N = 1.
- `4x-paving-and-bank`, `4x-roof-and-wall`, `4x-canopy-edge`: fixed boxes of the slice. `report.json` gives the share of
  2 x 2 device-pixel blocks that are one colour (one art px each at N = 2): 0.29 / 0.09 / 0.16 before, 0.86 / 1.00 / 1.00
  after. The rest is the lossy ground codec and figures.
- `demo-crop-*`: the demo spec's own 4x crops.
