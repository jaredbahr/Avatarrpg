# Route visual review against the approved references

- **Updated:** 20 September 2026, root (scheduled DeepSeek Flash continuation).
  Incoming owner: next scheduled session for the same goal.
- **Outcome:** a stills comparison of the newest route captures against the
  three approved references, with five concrete gaps and the frames that show
  each. No code, art or data changed by this review.
- **Evidence:** `assets/reference/player-view-2026-09-17/` (`ba-dan-exploration`,
  `causeway-exploration`, `quarry-battle`) against
  `.shots/route-final/{canvas,webgl}/` at revision `966d33a` plus this branch's
  water/oil painter change (`provenance.json` records `966d33a-modified`,
  oblique projection, 96 px and 64 px tiles, wheel/pinch zoom, real drag). The
  harness's own caveat applies: these are seeded fixtures entered with
  `enterNode`, not a playthrough, a listening test or a physical-device check.

## What the references do that the captures do not

1. **Material boundaries are organic, ours are polygon edges.** In
   `webgl/village_explore-96.png` paving meets grass along one straight
   diagonal; in `webgl/forest_explore-96.png` the sand road ends in long
   straight edges against both the grass and the flat backdrop; in
   `webgl/battle_grumbler-fit.png` the tan floor meets pale stone along a
   stepped polygon. The references join materials through dressed edges -
   laid stones, grass tufts, mud rims, cast shadow - so no material ends in a
   bare line.
2. **Water is still a tile-shaped polygon.** The forest pond in
   `forest_explore-96` is a 90-degree cross of flat teal, and the village canal
   in `village_explore-96` is a straight-edged band. The v0.2.3 painter pass
   fixed what the water looks like inside the region; the region's outline and
   bank are untouched. The references show an irregular shoreline with a
   visible bed, submerged stones, reeds and bank planting.
3. **Large fields carry no dressing.** The village mid-ground green field and
   the quarry floor are flat fills. Every surface visible in the references is
   worked: joints, rubble, tooling, scattered detail, edge shadow. This is the
   single largest "unfinished" impression in both captures.
4. **Prop and wall contact is unsoftened.** The two stone pillars in
   `battle_grumbler-fit.png` sit on plain dark rectangles rather than a
   grounded shadow; the rubble patch in `forest_explore-96.png` keeps a hard
   diamond border; and in `battle_quarry_gate-fit.png` the long wall casts a
   hard-edged grey slab with no rubble or grass at its footing. The references
   never show an object whose contact with the ground is a bare rectangle.
5. **Density and framing.** The references pack structures, props and NPCs
   along the walkable path and fill the frame edge to edge. Our captures leave
   a large empty middle ground and let the board's polygon edge show against
   flat paper - `forest_explore-96.png` cuts the tree trunks at the top edge of
   the map rather than occluding them with a canopy or hill.

What already reads: the paving, shopfront, stall, bridge and village props hold
up at play zoom, the characters are adult-scale and grounded, the HUD and
objective text are legible in every capture, and the quarry-floor pit tiles
read as hazards.

## Bounded next tasks, in the order that removes the most "unfinished"

1. **Dress the junctions** (render/gameplay): add a painted edge band where
   paving, road, grass, stone and floor meet, and place shoreline dressing -
   bank stones, reeds, mud rim - over the water outline so the tile polygon
   never shows. This is the highest-value change and needs no new rules.
2. **Re-author the pond and canal bed/bank plates** (art): the capture evidence
   says the bed is a uniform teal field and the bank is a hard edge, exactly as
   the [liquid-material handoff](route-water-material.md) records. The quarry
   floor's pale stain needs the same pass.
3. **Soften prop contact shadows** (render): one grounded, feathered shadow for
   pillar-, crate- and rubble-class props.
4. **Then re-capture** with
   `npx playwright test -c playwright.route-visual.config.ts` (point
   `FNT_ROUTE_REVIEW_DIR` at the new head) and repeat this comparison, including
   the portrait and Huge-text set in `.shots/route-portrait-huge/`.

## Coordination

- This does not change the v0.2.2 release: PR #64 merged as `5403473` and its
  deployed build shows `v0.2.2 · build 5403473`. This branch is rebased onto
  that merge, so the comparison above is against the shipped product code plus
  the branch's own water/oil painter change.
- This note is a stills review. It does not close any row of the
  [finish-through-driller](../finish-through-driller.md) acceptance table -
  audible listening, physical Surface/iPad play and continuous-play evidence
  remain open.
