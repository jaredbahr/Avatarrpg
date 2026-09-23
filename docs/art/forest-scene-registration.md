# Forest-road scene registration

The pond patch was subsequently replaced by the bounded
[shoreline correction](forest-pond-shoreline.md), which supersedes only the old
water source, packing and rectangle below. Its provenance is durable in the repository.

Status: source candidate packed; integrated visual review remains pending.
The separate art branch `codex/forest-road-art` starts after courtyard handoff
`0e3526d`. Gameplay owns projection opt-in and retains the legacy fallback.

The existing 20 × 12 map uses basis (64, 32), (-64, 32), origin (768, 0),
giving 2048 × 1024. Bleed of 128 left/right, 192 top and 64 bottom yields
2304 × 1280, split into two 1152 × 1280 images at (-128, -192) and
(1024, -192). Textures stay below 2048 pixels per dimension.

Permanent water is exactly (5,5), (6,5), (4,6), (5,6), (6,6), (7,6),
(5,7), (6,7). Its 12-corner union projects into x 576–896, y 320–480,
a 320 × 160 bounding rectangle. The technical SVG includes two collinear
intermediate vertices from actual cells. `scripts/art/forest-guide.ts` derives
both diagrams directly from `FOREST_ROAD.rows`; guides are not shipped art.

Rubble at (7,3) and (8,9) is walkable cover, represented by ground-only,
ankle-low fragments. `^` is traversable elevation 1. Gameplay retains live
elevation and high-contrast overlays. No new collision cells are introduced.

Pines use existing `T` cells only, with trunk feet at
`768 + (x - y) * 64, (x + y + 1) * 32`. The agreed maximum world bounds are
144 × 224; the packed source preserves its aspect ratio at approximately
99.82 × 224, with foot anchor (0.51, 0.99). No ground disk or baked shadow.
The northernmost tip fits inside the 192-pixel top bleed. Existing actor-aware
scenery fading handles canopy overhang.

Keep Dema (3,1), discoveries (2,9)/(16,9), exits (0,4)/(19,4), encounter
trigger columns 4/8 and all party/enemy spawn positions clear. Gameplay owns
pointer picking, both renderer backends and tactical validation.

## Authored sources and packing

Sources were generated with ImageGen in this task. Their local directory is
`C:/Users/Jared/.codex/generated_images/01a0b2ee-8d60-7643-be9b-340997ca4ae0/`.

| Source PNG                                      | Brief                                                                                          | Packed asset                  |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------- |
| `exec-22de7f0e-aa14-4a25-babd-e401a920a86b.png` | Four painted swatches: ochre road, olive grass/pine needles, teal water, pale limestone        | Two 1152 × 1280 ground chunks |
| `exec-43adf0b7-2780-4e35-b7ba-29056acd132c.png` | Narrow evergreen, transparent background, warm upper-left light, exposed trunk, no ground disk | `pine.webp`, 512 × 1149       |
| `exec-e9f5c408-b1f8-40f3-a303-25b460481d1c.png` | Shallow teal puddle following the supplied water guide, wet soil inside the boundary           | `water.webp`, 640 × 320       |
| `exec-ffb56a4e-d90c-4aaf-ab69-9a12898c6cac.png` | Low flat stone fragments and dust, transparent background                                      | `rubble.webp`, 384 × 128      |

`forest-ground.ts` registers the authored swatches to existing terrain cells.
`forest-water.ts` trims and uniformly scales the puddle to 632 × 320, centers
it in 640 × 320, then clips authored pixels against the exact water mask.
Packing removed 1,510 nonzero pixels outside water; it invents no painted pixels.
The underlying water swatch fills all eight water cells. `scene-image.ts` trims
and uniformly scales pine and rubble. Rubble renders at 128 × 42.67 world pixels.

The packed maps family is approximately 3.40 MiB against its unchanged 4 MiB
budget (2.43 MiB before this batch). Unit art remains unchanged. Source images
and technical guides have been inspected; material texture density, water edges,
pine occlusion and traversable ledge clarity still need the integrated review.

Validation: local npm run verify passed (624 tests), along with art:validate
and check:assets. Precache totals 13.98 MiB of 25 MiB. The forest scene is not
yet opted into the map, so integrated rendering and tactical checks are pending.

## DL-2 cleanup: the rubble heaps stand on their spill (2026-09-23)

The two rubble cells, (7,3) and (8,9), used to be holes in the ground plates:
`grass-north`, `grass-south` and `route-ground` left every `r` cell clear, so
the bare terrain (legend `r`, sand `#a89880`) showed round the heap as a flat
tan diamond with ruled edges, on both backends. Now the ground plates paint
those cells like the verge round them, including the road's ink line and
feathered join, and ask `spillAt` in `scripts/art/forest-rubble.ts` wherever
they would paint verge. Round each heap the verge gives way to the heap's
**spill**: the DL-2 §3 spoil key (`#a89880` / `#857762`, rim `#c2b49c`) read
through the courtyard lawn's structure. That is the `spill` tone in
`forest-village-material.ts`, the same material as the quarry's spoil terrace.
The spill covers the cell the live rubble wash lies on and carries on past its
edges. Over a band about a quarter of a cell wide it breaks up into the grass,
in clumps and round the lawn's own painted tufts, so its edge never runs along
the cell's diamond. It ends on the road's ink line.

`rubble.webp` now carries only what stands on that ground: the pile, its
contact shadow and two loose stones that have rolled clear. The pile's courses
are pulled in from the cell's side corners, because courses that ran out to
the cell's edges gave the pile the cell's diamond for a silhouette. Placement,
plate size and the scene's image count are unchanged.

| File                        | Before (B) | After (B) | Delta (B) |
| --------------------------- | ---------: | --------: | --------: |
| `rubble.webp`               |      3,942 |     3,998 |       +56 |
| `grass-north.webp`          |     60,934 |    61,236 |      +302 |
| `grass-south.webp`          |     48,022 |    49,176 |    +1,154 |
| `route-ground.webp`         |    112,886 |   113,520 |      +634 |
| `exterior-apron-0..11.webp` |    203,290 |   203,700 |      +410 |

The apron bands move only because they continue the re-encoded grass and route
pixels outward (`apron-plates.test.ts` pins them to those plates). The change is
WebP re-encode drift in the continued lawn, at most about 33 levels
premultiplied, with no spill carried outside the board. The live rubble wash is
unchanged and still marks the hazard cell. It is drawn over the spill, and its
inked bank is the one diamond cue left.
