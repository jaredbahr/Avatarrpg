# Quarry gate structural art plan

Status: proposed next implementation, not visual acceptance. The weathered
material commit3f2ffc4 is an incremental improvement. Its entry view remains far
from the approved quarry reference: flat open fields, ruler-straight road,
large flat stone patches and repeated cubic masonry dominate the composition.

Reference: `assets/reference/player-view-2026-09-17/quarry-battle.png`.
Current comparison: `gallery/scene-audit/quarry-gate-weathered-preview/canvas-entry.png`
and `webgl-wall-east-side.png`. Use identical96px camera/framing for the next
comparison, including a closer wall/courtyard view and live hazard view.

## Three structural changes

| Change                                                                  | Concrete authored result                                                                                                                                                                                                                                                                                                                                                                                    | Geometry and ownership                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Replace hard material cutouts with authored edge transitions         | The road becomes worn compacted track with irregular dusty shoulders, wheel wear and embedded chips; stone shelves gain shallow exposed lips, worn access slopes and dust collecting against rock. The marks respond to the boundary, not a repeated square texture.                                                                                                                                        | Art derives edge guides from exact `=`/`^`/`.` adjacency. A narrow12world-pixel decorative transition band may straddle road/earth boundaries; nominal tile boundary stays fixed. This is mixed surface texture, not a moved path. Elevation lips use actual elevation deltas and stay shallow/traversable. Gameplay owns elevation/picking agreement and crisp overlays.                                                                                          |
| 2. Replace repeated cubes with four coherent gatehouse/retaining masses | Each existing U-shaped blocked cluster receives a continuous authored structure: battered quarry stone base, bonded long faces, irregular coping and a taller gate pier at the passage-facing end; timber braces and iron fittings are attached to the structure. Northern runs read as cut-rock retaining architecture, southern runs as worked gatehouse walls. Height and silhouette vary intentionally. | Existing blocked sets are exactly x4..9 and x12..17 on y0/y11, plus their endpoints on y1/y10. All32blocked cells remain visibly solid at ground level. Open interiors and the x10..11 passage remain open. No roof or masonry fills open cells. Taller silhouettes may overlap actors in screen space and must depth-sort/fade correctly. Art owns continuous paintings and per-pixel depth ownership; gameplay owns atlas slice rendering, cutaway and fallback. |
| 3. Compose the empty space around actual activity                       | A continuous haul corridor leads from the left entry past the real cart toward the real brazier/oil crossing. Ground-only wheel wear, loading scuffs, stone dust and compressed foot traffic give large areas a purpose. Structure-contact shading and small attached hardware connect walls to the earth. Keep the oil crossing visually distinct through its live surface.                                | Art authors a registered full-ground composition from masks plus live-prop anchor guides, then removes guide markers before packing. No baked carts/barrels/flames/oil/guards or new apparent obstacles. Gameplay owns the larger live cart presentation and eventual guard replacement. All five props and four passable cover cells stay interactive/unchanged.                                                                                                  |

The broad flat fields will not be fixed by another uniform material recolor.
The road need not look like a perfectly cut rectangle merely because road tiles
have exact rules. Surface dust can mix across an edge while movement/overlay
boundaries remain honest. Conversely, raised rubble, deep cracks, stair barriers
or a gate spanning an open corridor would invent collision and are excluded.

## Rendering contract: coherent art with correct local depth

The current32-piece limit is not the fundamental reason for cubic repetition.
Three reused whole-image prisms are. Simply joining an entire U-shaped building
into one sprite would create incorrect actor occlusion at its different depths.
Also,32unique image files would exceed the16-image scene cache and can churn.

Recommended extension to ADR0023, recorded in a new ADR before runtime changes:
add an optional atlas source rectangle to SceneImage, retaining its existing
world destination rectangle. Pack unique depth-owned slices from the continuous
paintings into one or two atlas pages, each at most2048x2048. Reuse the same
source page across all slices. Canvas draws the source rectangle; Pixi uses a
cached subtexture keyed by page+rectangle. Alpha cutaway samples the slice's
source region, not the complete atlas. Validate rectangles, cache ownership and
texture disposal. Existing whole-image assets remain compatible.

Start with one depth-owned slice per existing blocked cell (32), using a shared
technical ownership mask to assign every painted pixel exactly once. Adjacent
slices contain adjoining portions of one authored wall, not standalone cubes.
Their ground anchors/footprints come from authoritative cells; vertical faces
and coping can have varied heights. No single depth anchor represents the whole
U-shaped structure. If the authored gate pier/eave separation needs additional
depth layers, raise the scene-instance limit to64 with the ADR and a measured
worst-case test; do not mutilate the composition just to preserve an arbitrary
32count. The unique-image cache need not grow when slices share atlas pages.

Terrain edge art should be baked into the existing two ground chunks after
registered compositing, avoiding dozens of extra runtime decals. Shelf lip
height must match the renderer's elevation lift; do not independently invent a
large cliff on a walkable elevation1cell. Existing cover decals remain separate.

## Allocation and delivery order

Art owns: continuous ground composition, edge/ownership guides, gatehouse source
paintings, atlas packing, scene content rectangles/footprints and provenance.
Gameplay owns: SceneImage schema/type extension, Canvas/Pixi slice drawing,
alpha-region cutaway, cache lifecycle, elevation/picking parity and cart scale.
Coordinate exact atlas metadata before generating final structural paintings.
No rule-grid, prop-state, save or pathfinding change is required.

1. Implement and prove atlas-source rendering/cutaway with a tiny technical
   fixture, then author the visible western cluster x4..9/y0..1 plus its approach
   ground. This is the quality proof slice, not a new region.
2. Compare actual play against the reference at entry, in front, behind and
   inside the existing U-shaped wall; include a legal traversal and target tap.
   Judge coherent silhouette, ground contact and readability in motion.
3. Apply the accepted structural language to the other three existing clusters
   and the remainder of the same gate ground. Preserve distinct wear/composition.
   Cutting/floor work follows actual gate qualitative acceptance.

Planning envelope: maps currently3.07MiB of4MiB. Replace the existing gate
assets, targeting at most650KiB total ground+structural atlas+cover (current
221,482bytes), leaving roughly0.5MiB family headroom. This is a proposed packing
allocation, not permission to raise the4MiB family/25MiB precache limits. Measure
actual output before promising it; do not degrade unrelated assets. New texture
pages stay2048or smaller, and GPU memory/disposal need explicit validation.

Acceptance requires both Canvas and WebGL: real move/target taps at edge bands,
all32blocked cells visibly explained, open interiors/passages apparently open,
local cutaway during front/behind traversal, cart/shove and live oil/brazier
interaction, missing-atlas fallback, high contrast, portrait/large text and an
unchanged-view comparison to the reference. Tests prove geometry and lifecycle;
only the actual compositional/moving review can pass the gate visually.
