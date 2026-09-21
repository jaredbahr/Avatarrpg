# Route review against the approved references, after the water pass

- **Updated:** 20 September 2026, fifth scheduled DeepSeek Flash continuation
  run. Incoming owner: the next scheduled session for the same goal.
- **Outcome:** a stills comparison of this branch's whole-route captures against
  the three approved references, recording what the water pass fixed and the
  four gaps that remain largest. No code changed by this review; the capture
  revision already carries the pond shore bite, the pond bed, the canal bed and
  the pond bank reeds.
- **Evidence:** `assets/reference/player-view-2026-09-17/` (`ba-dan-exploration`,
  `causeway-exploration`, `quarry-battle`) against
  `.shots/water/reeds1/{canvas,webgl}/` at revision `200cdb7` (the reeds commit
  on this branch; `928f86c` adds only this handoff), 1368x912, seeded fixtures
  entered with `enterNode`, oblique projection, Canvas and WebGL compared frame
  for frame and matching. Not a playthrough, not a listening test and not a
  physical-device check.

## What the water pass fixed

- The forest pond is no longer a flat teal cross: the bank wanders inside its own
  water cells, the bed under the water is the forest's own floor darkened with
  depth, and three reed fringes stand on the cells that touch the water. Compare
  `.shots/water/bed3/canvas/forest_explore-96.png` (before) with
  `.shots/water/reeds1/canvas/forest_explore-96.png` (after), and the stacked crop
  `.shots/water/reeds1/pond-before-after.png`.
- The Ba Dan canal is no longer a straight pale band: `canal-banks.webp` carries a
  channel bottom cut from the village's own paving, shaded and cooled with depth,
  under a kerb dressed toward grey with a wet band at the waterline
  (`village_explore-96.png`).

## What the references still do that these captures do not

1. **Density and framing.** The Ba Dan reference packs shopfronts, a bridge, a
   lily pond with ducks, planters, banners and a dozen people edge to edge. Our
   `village_explore-96.png` leaves a large flat green middle ground with one tree,
   and the board's polygon edge shows against bare paper at the map's border, most
   visibly in `battle_quarry_gate-fit.png` (flat cream triangles down the left and
   bottom-left). This remains the single largest "unfinished" impression.
2. **Large fields carry no dressing.** The village's mid-ground field and the
   quarry floor are flat fills; every surface in the references has joints,
   rubble, tooling, scuffing or edge shadow. The water pass did this for the two
   waters only.
3. **Planting is still thin.** The pond now has reed fringes and the courtyard has
   trellis planters, but the references grow vegetation along walls, kerbs and
   banks continuously. The authored reed mass is a washed-up heap, so the new
   fringe reads as cut reeds rather than upright rushes; upright growth needs an
   image generator this environment does not have.
4. **Light and colour.** The references are warm, high-contrast and sunlit, with
   long soft shadows and cool shadow only inside the water. Our frames are cooler
   and flatter, especially the grass, and the quarry gate's dirt is a broad even
   tan. Some of this is the contact work in flight: PR #68 feathers prop and
   figure contact, which these v0.2.5-based captures do not include, so re-judge
   contact after that merge rather than from this note.

What already reads: the paving, shopfront, stall, bridge, courtyard props and
stone walls hold up at play zoom; characters are adult-scale and grounded; the
HUD, objective text and touch dock stay legible; the pond and canal now carry a
bed; and Canvas and WebGL agree on every compared frame.

## Coordination

- This note closes no row of the
  [finish-through-driller](../finish-through-driller.md) acceptance table:
  audible listening, physical Surface/iPad play and continuous normal-input play
  remain open and unclaimed.
- The capture revision is this branch's head, which is still unshipped; the
  release that carries it is described in
  [pond-reeds.md](pond-reeds.md), [pond-bed.md](pond-bed.md) and
  [canal-bed-bank.md](canal-bed-bank.md).
- Next action is unchanged and owned by the release: watch PR #68, then rebase
  this branch onto its merge, bump to `0.2.7`, add the changelog and open the PR
  with merge-commit auto-merge. Take the density and field-dressing gaps after
  that release, and only with authored material.
