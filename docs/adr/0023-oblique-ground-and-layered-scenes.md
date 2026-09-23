# 0023 â€” Oblique ground and layered scenes

Status: implementation in progress; Ba Dan composition is not yet accepted.

## Problem

The approved player views show a cropped, elevated neighborhood with upright
adults, roofed architecture and foreground overlap. The former rectangular
whole-map painting cannot provide that result. Skewing its baked roofs would
distort buildings and detach their visible paths from picking and collision.

## Decision

Keep rule coordinates, pathfinding, ranges and save positions on the existing
logical grid. A map may opt into `projection: 'oblique'`. At 64 world pixels per
logical tile, its ground basis is X=(64,32), Y=(-64,32). Normalize the projected
grid bounds by subtracting their minimum X/Y; the 24Ã—16 village therefore has
ground origin (1024,0) and projected extent 2560Ã—1280. `Camera.project` and
`unproject` are the forward/inverse contract. Picking floors the inverse result,
including outside the map; rule validation still rejects invalid destinations.

Both backends transform ground geometry, overlays and paths with that matrix.
The WebGL ground shader inverts the same matrix. Unit and NPC drawings stay
upright and attach their foot anchor to the projected footprint center. A
two-cell unit spans its two logical X cells; it is not a screen-space rectangle
for targeting. Depth order follows projected ground Y, including scenery and
NPCs. Camera zoom and recenter operate in projected space; visibility considers
all four inverse-projected viewport corners.

Existing paintings are not used under an oblique map unless explicitly tagged
and calibrated for it. `MapScene.ground` contains already projected image chunks;
`scenery` contains upright image rectangles, logical footprints, a ground depth
anchor and optional roof cutaway. Image rectangles use projected world pixels,
before zoom/pan, and can extend beyond the ground bounds. Ba Dan's agreed art
padding is left/right 128, top 192, bottom 64. A 2816Ã—1536 composition is tiled;
each texture must remain within the existing 2048Ã—2048 limit.

Ground art contains no baked figures or tall buildings. All walking and blocked
areas must agree with the authored logical map. Roofs fade when they obscure
living units or a nearby NPC behind their ground depth. Future route points do
not fade scenery before anyone reaches it.
A cached alpha mask distinguishes opaque pixels from transparent padding; distant
NPCs do not keep the neighborhood faded. Depth anchors may be fractional logical
coordinates; collision footprints remain integer cells. The art
does not change collision. Missing scene pieces keep procedural terrain visible
so invisible architecture does not conceal blocked cells. Scene images have a
separate bounded loader cache; individual GPU textures are released when the
scene changes.

A scene may declare `paintedWater` when its ground includes accurately registered
permanent water and banks. Normal-contrast rendering then retains that artwork;
dynamic surfaces, hatch/high-contrast views and incomplete-art fallbacks still use
the rule-surface layer.

Ba Dan starts with a closer camera crop. After walking, followers gather at legal
nearby seats using the same collision and diagonal-path rules. They animate into
place; the saved leader position is unchanged. Subsequent walks path from those
actual seats rather than assuming they still form an adjacent breadcrumb chain.
Movement headings and attack offsets use projected screen tangents. Existing
four-direction art still approximates diagonal travel, and combat-ready idle
poses are not a substitute for relaxed exploration artwork.

Its local map derives terrain, party,
NPCs and available exits from actual state. Header, objective and compact party
dock share the screen; an explicit map action exposes routes. Saves, story
outcomes and travel commands are unchanged.

## Validation and limits

Test axes, negative bounds, edge picking, zoom anchors, resize/recenter and
two-cell anchors. Exercise actual projected taps and collision on both backends,
then run the complete custody routes and save/reload regression. Compare matched
1672Ã—941 screenshots and a motion sequence against all three approved views.
Also inspect portrait, largest text, reduced motion and missing-image fallback.

Correct transforms and green tests are necessary but do not establish visual
acceptance. The first milestone remains unfinished until Ba Dan's real layered
art, framing, contact, navigation and motion have been reviewed together. Apply
the accepted system through the quarry slice before adding any new region.

## Readable combat framing

Oblique combat opens and resets at a96CSS-pixel logical tile minimum, centered
on the acting unit, rather than fitting distant actors into the entire board.
Party scale remains shared with exploration; animation scales multiply it.
Orthographic maps retain their fitted-board behavior. Initiative focus and
Acting unit pan without changing zoom, tactical selection, AP or turn; live
units are revalidated when activated. Recentre restores the readable default.
The portrait HUD shares summary/actions where they fit; narrow huge-text layouts
scroll the header and bound the HUD height so the battlefield retains space.
No rule-grid, save, hit-test or enemy footprint changes accompany this framing.

## Explicit painted rubble registration

`MapScene.paintedRubble` lists exact cells already represented by ground art.
Only matching permanent rubble whose scene art is fully loaded suppresses the
duplicate normal overlay, in complete and partial scenes alike (partial scenes
keep every other permanent surface live, including water). The authored heap
carries the ink outline that marks the hazard; the wash and bank over it drew
the tile diamond its painted spill hides (PR 95). High contrast, crisp overlays, unavailable art, other cells,
and changed surface types/durations retain the procedural treatment. Both
backends use the same predicate and WebGL includes per-cell suppression in its
texture invalidation signature. Forest opts in only(7,3)/(8,9). This changes no
surface state, movement, cover or save data. A permanent rubble effect at an
already registered permanent-rubble cell has the same representation; effects
elsewhere and different/temporary surfaces still draw normally.
