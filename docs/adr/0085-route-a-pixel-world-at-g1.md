# ADR 0085: Route A: Ba Dan's world drawn at the characters' grain (G1)

**Status:** accepted, 2026-10-27

Supersedes the rendering parts of ADR 0076 (Ba Dan is one continuous painting) and ADR 0083 (Ba Dan: calm ground plates).
The continuous-painting pipeline itself (regions, stitch, frozen geometry, split, pack) stands. The maps family budget
(7.5 MiB) is unchanged: the family measures 6.75 MiB.

## Context

Issue #284 ran a bake-off for the art direction after the owner judged the village "very ai" beside the figures. The
painted world was glossy, at about twice figure scale, and had no pixel structure; the figures are crisp PixelLab G sprites
(Phase 0 audit on #284). Route A redid the world's rendering in the figures' own generator (PixelLab), keeping the locked
layout (draft PR #287, round 1 and a grain ladder). On 2026-10-27 the owner chose it: _"Let's do that pixel approach is
looks cleaner. Polish ba Dan further for me to review again with a more complete demo."_ G1 was picked over G2 (2x
chunky), whose fruit and faces did not survive. Routes B (hybrid) and C (hand) close.

## Decision

**Master hand.** Everything in a map comes from the PixelLab G family that made Kaya's G sheet: the world through
`edit-images-v2` (`edit_with_text`), the figure-scale objects and small fixes through Pro Flash (`edit-image-pro-flash`,
`inpaint-image-pro-flash`), the residents and party through the G pipeline. No figure is ever passed as a reference image
for world art: it pastes ghost copies of the figure into the scene (#287 round 1).

**Grain (G1).** 1 art px = 1 world px. A ground tile diamond is 128 x 64 art px on the 2:1 oblique grid (26.57 degrees), and an
adult figure is about 59 art px tall (Kaya's idle: 118 sheet px at 128 sheet px per 64 px tile). World art is generated
at world px; a restyle at higher resolution leaves the input nearly unchanged, so it is not a way to get finer marks.

**Rendering rules** (the brief of `docs/art/object-style-diagnosis.md` section 2, applied to the world too):

- contour 1 art px, dark brown anchored to `#1b1410`, on silhouettes and deep overlaps, interrupted inside;
- 3–5 flat tone groups per material, 2–3 for small goods; matte; no white glints, golden bevels or shine rings;
- one warm key light from the upper left, cool brown shadows down-right, the cast shadow painted into the ground;
- calm walkable ground by design: grass, paving, banks and water as broad areas of 3–4 tones with sparse 1–2 px marks,
  and no filter afterwards.

**Object scale** (screen px at the 1.5 camera, H = 89 = 59 world px; measured on the #288 set):

| object          | size                                                |
| --------------- | --------------------------------------------------- |
| ordinary basket | 0.22–0.32H wide (stock baskets larger, about 0.36H) |
| fruit           | 3–6 screen px, under half a head                    |
| market table    | 1.5–2H long, top 0.45–0.55H high                    |
| bench           | seat about 0.26H high                               |
| door clearance  | 1.2–1.5H                                            |

**Pipeline.** `art/source/ba-dan-route-a/tools/world.py` restyles the whole stitched painting at world px in one pass
(one prompt, one seed, 512 px tiles, feathered joins). `objects.py` inpaints the baked oversized objects out and sets the
G objects of `art/source/ba-dan-market-g/` (PR #288) in at their footprints, with a flat pixel cast shadow and contact
line. It points those pieces' frozen geometry at the new silhouettes (`geometry/sprites/g1-*.webp`, same footprint, depth
and flags). `regions.py` writes the twelve regions back as crops of that one painting, so every overlap matches. Then
`regen.sh` splits and packs as before.

**Delivery scale.** The regions stay at 1.5 painting px per world px, and the G1 art is scaled to it by EPX x2 and a 0.75
Lanczos, the same kind of reduction the G sheets get on screen. At the explore camera's 1.5 zoom a painting px is a screen
px, as before.

**Some upright pages are lossless.** The packer tests each upright as lossy WebP at q100 against the uprights'
fine-grain contract (`lossyError`, max 80, mean under 4). Pixel art whose 1 px colour edges 4:2:0 chroma subsampling
cannot hold goes onto its own lossless page (libwebp method 6, alpha exact), its colours first put on a 5-bit grid per
channel (`fiveBit`: at most 4 off). Every other upright stays on lossy pages, encoded by `encodeUprightWebp` as before.
Measured: 8 of the 46 uprights (five trees, the fruit table, the shop stack and a planter) make page 2, 0.65 MB (1.34 MB
exact). Ba Dan's folder is 15 files and 3,483,970 bytes; the maps family is 6.75 MiB, inside 7.5. The 5-bit step is
there for the precache total (25 MB), which with the residents (ADR 0084) leaves under 0.4 MB of room: 24.74 MB.

**ADR 0083's calm is off** (`QUIET_GROUND = False` in `regions.py`). At G1 the ground is drawn calm, and the median
filter blotted it. The step and its tests stay, behind the switch.

## Consequences

- The world and the figures share one generator, one contour and one light. The figures' marks are still a little finer
  on screen (0.75 screen px per sheet px against 1.5 per art px), because the camera is not at an integer zoom.
  **Open:** a single on-screen pixel grid needs the camera to snap to 1x or 2x (`Camera.fit`, pinch zoom). That is a
  camera ADR, not decided here.
- Moving or replacing a piece is still a frozen-geometry change. A replaced object keeps its footprint and depth key and
  changes only its silhouette.
- New maps follow the same order: lay out, paint or generate a guide, restyle at G1 in one pass, set the G objects in,
  split.
- Residents and party animation follow the G standard of #284 (eight-way, CMU or Mixamo motion, ADR 0067 cadence).

## Amendment, 2026-10-27: Ba Dan completed at G1

The owner, after whole-village before/after shots: "This is looking better. Let's complete ba Dan as is." This round:

- **Ground pass** (`tools/ground.py`): the G1 world re-rendered once more by PixelLab (28 tiles, one prompt, seed 11). Only
  plain ground (no piece owns it, not canal water) takes the result, and paving and grass are levelled per material at large
  scale, so no tile tint survives. Grass has living texture; paving is even.
- **Furniture with mass** (`tools/furniture.py`): the three market tables, the bench, both basket groups and the shop stack
  redrawn by Pro Flash on #288's own G1 canvas and anchor, with thicker legs and tops, a full `#1b1410` contour and goods
  that read at 1x (fruit 3-4 px with one highlight; no near-white).
- **Every #288 family set in**: the well, banners, lanterns, the laundry line, the notice board, the handcart, the stone
  lantern, the trough, the three planters and the garden plot (laid from #288's kit). No old-scale painted object is left
  outside the houses; Gao's yard cart stays painted (one try returned the same cart, which at G1 stands about half a figure
  high).
- **Cleared paving is filled from the tile grid**: each hole pixel takes the paving a whole number of tiles away, so the
  flag lines run on, then every patch's large-scale tone is matched to the plain ground around it (at most 30 levels).
- **Uprights**: the set stays the shipped 46 (`Village.KEEP_UPRIGHT`), so the courtyard props and dressing stay scenery.
  Projection: the new tables, planters and trough are pinned (`pins-g1.json`; a generated leg's feet get atan(3 px / span));
  posts, lanterns, the laundry line, the notice board, the handcart and the shop stack stand on points or one line and are
  exempt, with that reason in the test.

## Amendment, 2026-10-27: the polish pass

Owner: "Do a pass and clean up visuals. Tree roots and other items are off." `tools/polish.py` runs on the completed G1 world
(`world/world-g1.png`, the exact source of the shipped regions) and writes `world/world-g1-polish.png`, which `regions_back.py`
(`WORLD_G1=...`) and `regen.sh` turn into the shipped art. All twelve regions pass the registration gate without `--force`.
PixelLab jobs and outputs are in `polish/` (41 jobs, 270 generations, 44 of them on rejected tries).

- **Roots**: 14 trunk feet (the court tree (5,5), the canal and rim trees) are redrawn by one Pro Flash inpaint each over the
  root spread their frozen silhouettes trace, so the roots sink into soil with grass, earth and a contact shade. The frozen
  silhouettes do not change: where a long root was, the tree's upright now carries grass, exactly as it carried the root.
- **Props at mass**: the lantern posts (x1.6, about 1.5 figure heights), banners and notice board (x1.4), handcart (x1.6)
  and trough (x1.3) are redrawn by Pro Flash at their new size and set on the same ground point, with a contact pool and
  the key-light cast. Their pieces' world rectangles grow to hold them; footprint, depth key and flags are unchanged. The
  bench's and fence's long cast bars (one lay over the canal) are shortened.
- **Garden plot**: #288's kit and the old furrows and see-through box are lifted; the bed is drawn as a guide on the plot's
  exact diamond and rendered in the world's hand by one `edit-images-v2` pass.
- **Paving**: every flag (paving between its joints) is calmed toward its own median and its colour toward the paving's,
  so the pink squares, light patches and smudges go and the joints stay; the ghost of a post on the east road is
  inpainted.
- **Rim**: the pale ghosts of paving at the page edge (top-left) are put back to the page colour; the paving ghosted into
  the woods behind the north wall is redrawn as woodland floor.
- Gao's yard cart stays the painted one (it fits the house sprite and was not redrawn in this pass).

## Amendment, 2026-10-27: the regions at 1 px per world px (ADR 0088)

The G1 world was scaled to the regions' 1.5 painting px per world px by EPX x2 then a 0.75 Lanczos (`compose.up15`), and
under the integer-zoom camera that art is smoothed at N = 2. The world is now cut as it is drawn: `regions.py` runs at
`SCALE = 1`, the region size stays the image tool's 1536 x 1024 (a 3 x 2 grid now), and `regions_back.py` crops
`world/world-g1-polish.png` without resampling. It first clears `accepted/` (the 1.5 regions must not be stitched with the
new ones), renders the frozen geometry at 1 px (`render-village.ts` area-averages its 1.5 px sprites), and builds every guide
over the master itself (`guide all --ground`), so each crop is gated against the frozen uprights; all six pass without
`--force`. Origins and plate cuts sit on whole, even world px (`GRID`), and the fade is restated in world px (8 flat, 48 to 96
reach). Nothing was generated: this is a re-cut, and the master is the polish pass's.

- The 46 uprights, their footprints, depth keys and flags are unchanged (`baDan.test.ts`, `baDanDepth.test.ts`). Their alpha is
  the frozen silhouette rasterised at 1 px.
- `ba-dan-projection.test.ts` keeps the pins read on the 1.5 px canvases (`pins-g1.json`, `ba-dan-true/pins*.json`) and scales
  each window to the painting's scale, rounded inward (a widened window took in the next leg of `gao-display`).
- Fixed on the way, ahead of the re-cut: the colour change a hidden upright pixel takes was also sampled where a ground piece in
  front owns the painting, which is that piece's colour, not the repaint's change (`split_sprites`).
- Before and after at N = 2 (1368 x 912, 1 dpr): see the PR.
