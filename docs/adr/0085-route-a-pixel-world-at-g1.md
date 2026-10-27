# ADR 0085: Route A: Ba Dan's world drawn at the characters' grain (G1)

**Status:** accepted, 2026-10-27

Supersedes the rendering parts of ADR 0076 (Ba Dan is one continuous painting) and ADR 0083 (Ba Dan: calm ground plates).
The continuous-painting pipeline itself (regions, stitch, frozen geometry, split, pack) stands. The maps family budget
(7.5 MiB) is unchanged: the family measures 7.41 MiB.

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
cannot hold goes onto its own exact-lossless page (libwebp method 6, so the silhouette's alpha stays exact). Every
other upright stays on lossy pages, encoded by `encodeUprightWebp` as before. Measured: 8 of the 46 uprights (five trees
just over the max, 81 to 117, and the fruit table, the shop stack and a planter over the mean) make page 2, 1.34 MB
lossless; pages 0 and 1 are 0.79 and 0.21 MB lossy. The ground plates shrank (1.97 to 1.83 MB), because the ground is
drawn calm and no longer filtered. Ba Dan's folder is 15 files and 4,170,544 bytes; the maps family is 7.41 MiB, inside
its budget.

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
