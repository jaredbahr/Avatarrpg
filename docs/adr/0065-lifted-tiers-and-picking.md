# ADR 0065: Lifted tiers on the oblique board, and picking by the lift

**Status:** accepted, 2026-09-29

## Context

ADR 0061 §5 and §6 set the direction for readable height: lift each tier by
about 0.2 of a tile, draw full faces on the exposed sides, shade the lower tier,
draw ramps as steps, and make a tap pick the tile that is drawn, not the flat
cell a lifted top happens to cover. Until now the oblique board drew every tile
flat, ADR 0008's cliff bands sat inside the lower tile, and actors stood 0.06 of
a tile up. Nothing read as a tier, and the Driller floor's ramp benches looked
like any other ledge.

The ground on the oblique board comes from three places: procedural terrain,
authored scene ground, and the rule overlays drawn on top. Painted ground
already carries some height. The forest shelf plate is painted with its top
16 of 64 pixels (0.25 of a tile) above its footprint, with its own faces. The
quarry pages (the Cutting and the Driller floor) stand each bench at the old
0.06 lift with a sliver of face.

## Decision

1. **One lift: 0.25 of a tile a tier** (`TIER_LIFT`,
   `src/render/geometry/elevation.ts`). This is the forest plate's painted rise,
   so painted and procedural ledges agree, and two tiers stay at half a tile or
   less. Only walkable raised tiles are lifted. A blocked mass such as the `X`
   rock face is drawn upright by its scenery and keeps a flat ground. The
   orthographic board keeps ADR 0008's bands and the 0.06 actor lift
   (`FLAT_TIER_LIFT`). Only a test fixture reaches that path now.
2. **A lift pass after the flat ground.** Both backends draw the ground flat
   exactly as before, including the painting, surfaces, overlays, the path and
   the aim arc. `liftOps` (`src/render/geometry/lift.ts`) then walks the cells
   in painted order (rising x + y). For each raised walkable cell it:
   - redraws the cell's top a lift higher, sampled from that flat picture;
   - tints the top a little lighter and warmer per tier, twice as much under
     High contrast;
   - draws the south and east faces from the lower neighbour's height up to the
     lip. A face is the cell's own painted stone, sampled from the strip just
     inside that edge, in flat tone steps: a shadow (the east deeper than the
     south), darker again toward the foot, and a lit course under the lip. Ink
     goes only on the lip and the foot, so a face reads as the same painted
     stone as the Quarry Gate's cut rock, not as a vector extrusion. A face
     toward a wall drops one tier, not all the way to the floor;
   - inks the breaks and draws a lit rim on the north and west edges;
   - shades the lower tier along a higher north or west neighbour.

   A ramp (`S`) reads as a few broad steps: two treads a tile toward the side
   it steps down to (the front side first, so a corner does not cross-hatch).
   Each tread is a dark riser band and a lit nosing. It stops short of the
   tile's ends and is nudged per tile, so a bench of ramps breaks into steps
   rather than ruling one long stripe. The face gets one lit course per step.
   A plain ledge gets one.

3. **One op list, two interpreters, drawn once.** The ops are plain data in
   screen pixels, grouped by cell (`liftPlan`), and both backends draw every
   op, so this is board-correctness parity, not fidelity. They draw them into
   a **lift layer**: a canvas on Canvas 2D, a render target on WebGL, cropped
   to the raised blocks on screen (`LiftPlan.bounds`) and snapped to device
   pixels. The layer is redrawn only when the plan (camera, viewport,
   footing) or the ground it copies changes. Each frame the flat ground is
   drawn as it was before this ADR, and the layer goes over it in one copy.
   - Canvas 2D builds the layer from the frame it has just drawn, copying
     each top and face from the box round it, never the whole canvas.
   - WebGL renders the ground stack, cropped to where the ops read
     (`LiftPlan.sources`), into a source target, fills the ops from it into
     the layer, and lets the source go once the layer has held for a frame.
   - The layer is released (its canvas zeroed, its target destroyed) when no
     raised block is on screen, on the orthographic board, and when the
     backend is destroyed.
4. **Art keeps what it already lifts.** `MapScene.reliefLift` says how far the
   loaded ground art already lifts a tier: 0.25 for the forest and 0.06 for the
   quarry pages. The pass samples each top from where the art stands and lifts
   it the rest of the way. Art painted at the full lift draws its own blocks,
   so the pass does not draw the forest shelf's tops or faces again: it only
   puts the painted block back over the marks drawn flat beneath it.
   While scene art is still loading, the procedural ground is lifted in full.
   A list gives each tier's top in turn. The Driller declares `[0.06, 0.25]`
   because its gantry plates paint each tier-2 deck a full step up, whole, with
   the joists beneath it. Where the art already paints a face as tall as the
   one the pass needs, the face is lifted with the top, unshaded, so the perch
   reads as the timber it is painted as.
5. **Picking follows the lift.** `pickCell` treats a cell as its diamond swept
   up by its lift, which is exactly the shape the pass draws. A pointer lies
   over cell c when the segment from its flat ground point to that point plus
   (L, L) crosses c; of the cells it crosses, the last one painted wins.
   Every tap, hover and long press goes through `Camera.pickTile(x, y, grid)`.
   No lift is more than half a tile, so a flat tile centre still picks its own
   cell, and the existing tap specs are unchanged.
6. **Marks take the whole lift.** The marks over art go on each raised top
   shifted by the cell's whole lift, whatever `reliefLift` says; the tops and
   faces still sample the ground by only what the art has not lifted.
   Procedural ground's surfaces and decor stay with the ground, which lifts in
   full anyway. The marks are drawn flat with the ground, as before, and the
   layer covers the raised blocks' flat copy. They then come in two kinds:
   - **Static marks** change only with the ground: the seams and rule markers
     over art, and on Canvas 2D the surfaces over art. They are baked into the
     layer by each cell's `overlay` op, drawn straight under the top's clip
     and translated transform (Canvas 2D) or filled from a cropped render of
     them (WebGL).
   - **Live marks** change between frames: ranges, hover, the path, the aim
     arc, exits, ground effects, and on WebGL the surfaces over art, whose
     shader moves. `markedCells` finds the cells one may reach, and
     `marksSchedule` lists the raised tops near them in painter order. Only
     those tops take the marks again. A taller block in front of a marked top
     is copied back from the layer first, so a mark never shows through a
     block drawn after it. Canvas 2D draws the marks straight onto each such
     top, with the tile painters kept to the cells round it. WebGL renders
     the live layers into small targets cropped to groups of nearby tops
     (`clusters`), only when the marks change, or every frame only while
     something that moves by itself (a pulse, a spray, water, fire) is on a
     marked top.
7. **Actors stand on the lifted top.** Units, NPCs, props, rings, markers and
   attachment sockets use `liftAt`. A figure between cells uses `liftAlong`, a
   blend of the four cells round it, so a walk up a ramp climbs rather than
   popping.

## Consequences

- Parity is held in `e2e/viewport.spec.ts` and `e2e/renderer.spec.ts` on both
  backends. The first hovers over and taps the far corner of a lifted top, a
  point the flat pick gives to the cell up and to the left. The second checks
  that the lifted bench's stone covers the dirt behind it. Both fail with the
  lift or the lifted pick turned off.
- Anything drawn flat on a raised cell lifts with it, including overlays,
  surfaces and the hover highlight, by the same lift the pick and the actors
  use, on the forest shelf as on the Driller's benches. `renderer.spec.ts`
  hovers a raised tile on both maps and both backends: the lifted top must
  lighten and the tile's own south face must not. It fails on the pass
  without the marks layer. A path or aim arc that crosses a tier boundary is
  cut at the lip. A painted plate that overhangs its cell lifts only its
  in-cell part.
- **Cost.** A still raised board costs the flat pass plus one copy of the
  layer a frame: no rebuild and no render into a target until the camera, the
  viewport or the ground changes. `liftCost` (on `window.fnt`) counts layer
  builds, target renders and canvas copies and the pixels each covers, and
  `renderer.spec.ts` holds a still Driller board on both backends to no
  rebuild and no board-sized copy or render. The pass holds one layer no
  bigger than the raised blocks on screen, plus small marks targets on WebGL.
  On the Driller its two benches run corner to corner, so that crop is still
  most of the screen: about 14 MiB at the iPad Pro's 2732x1462 map canvas,
  where the first cut held two full-size stores (about 30 MiB). Boards with
  no raised walkable cell on screen hold nothing and take the old single
  pass.
- Things that move by themselves in the ground are not re-copied every frame
  for a raised block. WebGL's breeze over the grass stays on the flat pass and
  is left out of the layer, and the terrain shader's motion under partial art
  is baked into it, so both pause on a raised block's top. A board drawn
  wholly procedurally (a non-partial scene whose art has not loaded) is the
  exception: its surfaces live in the ground, so its layer is rebuilt every
  frame, as the first cut did. Live marks on a top are drawn over the top's
  back-edge ink, where the first cut drew them under it.
- Ground effects drawn with additive blending onto a raised top go through a
  transparent marks target on WebGL, so there they composite a little softer
  than they add. Canvas 2D draws them straight on.
- New ground art should be painted at `TIER_LIFT` with its own faces, or flat,
  and declare which in `reliefLift`.
- Not done here from the ADR 0061 plan: grass-tuft overhangs on forest
  shelves, the climb ▲ and hatched tier edge in the move overlay, and the
  target preview and inspector height rows (plan 2.3 items 3 to 6).
