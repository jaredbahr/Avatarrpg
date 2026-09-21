# Ba Dan exterior apron

The village's authored pieces cover the playable diamond exactly. Outside it the
page wash showed through, so the rim read as the edge of a board: the outer
grass, the eastern plaza approach and the western road all ended on one hard
diagonal against bare backdrop. The references show the village running out of
frame instead, so the rim needed ground, not a frame.

`public/art/maps/ba-dan-scene/exterior-apron.webp` is that ground. It is packed
by `scripts/art/ba-dan-exterior-apron.ts`, which is the only writer of the file;
`scripts/art/ba-dan-exterior-apron.test.ts` re-packs it and compares bytes, so the
plate and its generator cannot drift.

## Composition

| Property              | Value                                                               |
| --------------------- | ------------------------------------------------------------------- |
| Logical depth         | 2.5 tiles outside the rim, on all four sides (`BA_DAN_APRON_DEPTH`) |
| Registered rectangle  | `BA_DAN_EXTERIOR_APRON`, 3200×1600 local pixels                     |
| Opaque band           | from the rim outward; `APRON_FADE` 2.2 tiles to fully transparent   |
| Terrain               | the procedural cells' own grass, road and paving colours            |
| Material continuation | the outer cell's road or paving for `MATERIAL_REACH` 1.15 tiles     |
| Playable coverage     | none — every sample inside the board is alpha 0                     |

Each apron sample takes the terrain of the board cell it borders: the terrace
fill for that cell, continued where that cell is road (`=`) or paving (`.`,
`l`), then blended to meadow by 1.15 tiles out. Detail is the tile painter's own
pass — four short blades on grass, two or three pebbles on road and paving — at
the same 64 by 32 projected lattice, with the same hash over each cell's logical
coordinates, so density and rhythm outside the board match the cells inside it.
Grain and a 10% recession ramp in over the first 0.35 tiles and deepen with
distance, which keeps the board's own edge from being drawn a second time as a
line between flat procedural ground and its grained continuation.

Nothing is drawn under a drawn cell: the renderer's ground pieces paint in
registration order and this one is last, so it cannot cover authored art that
already reaches the rim. The piece adds no scenery, no footprint, no collision
and no path — `src/content/scenes/baDan.test.ts` pins the registration and the
world size, and the art test pins the alpha behaviour.

The plate is one 3200×1600 texture, inside the 4096 limit both backends' GPU
path assumes, and it is a single extra decode at 30 KB. Both backends treat every
registered ground piece as part of the scene's readiness gate, so a missing apron
degrades to the procedural board rather than to a broken frame.

## Provenance

Original procedural art, generated in-repo on 20 September 2026 from the
shipped palette in `src/render/palettes.ts`; no external samples and no
generated-image source. The apron replaces no existing asset and introduces no
new material — it reuses the village's own terrace vocabulary, which is what
makes the join at the rim invisible.

## Review

Captured in the release handoff
[`ba-dan-exterior-apron.md`](../coordination/handoffs/ba-dan-exterior-apron.md)
on both backends at the four rim faces, the road exits and the default follow
camera. The forest road's own rim is the same defect and remains open; it is not
covered by this plate.
