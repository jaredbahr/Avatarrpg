# ADR 0124: Health bars keep clear of bunched neighbours

**Status:** proposed, 2026-11-21. Amends the combat health-bar placement both backends share
(`src/render/geometry/actorSilhouette.ts`); builds on ADR 0094 (figure scale) and ADR 0100 (world-pixel overlays).

## Context

Every unit's health bar sits a small gap over its own figure's head, and both backends draw the bars after every
figure, so a bar is always on top. `HealthBarStagger` already lifts a bar that collides with another bar. It knew
nothing about figures.

A top-down figure stands about 1.15 tiles tall on a one-tile cell, so the gap over the head of a figure is where the
figure one cell behind it has its legs and waist. When two units stand one cell apart in a column, which the demo's
fights do all the time (the Forest Road opening, a melee scrum, two guards holding SF-2.3's bridge), the front unit's
bar is drawn straight across the body of the unit behind it. The combat juice audit (2026-11-21) found it in the
Forest Road opening. It breaks the owner's rule for effects and interface: nothing may cover who got hit.

Options weighed:

- **Draw each bar in depth order, right after its own figure.** A figure in front would then cover the bar of the one
  behind. It does not help here: the bar at fault belongs to the figure in front, drawn after the one it covers.
- **Always put the bar under the feet.** Then it lies on the head of any figure one cell in front, which is worse
  than legs, and it moves every bar on every board.
- **Show full bars only for the active unit and the target.** Less clutter, but the bars a family reads to choose a
  target would disappear, and the two shown bars can still collide.
- **Move only the bar that would lie on another figure, to a clear slot.** Chosen.

## Decision

1. **A bar has two slots.** Over its own figure's head, as before, and under its own feet: clear of a one-tile
   figure's status badges (just under the foot line) or, on a two-tile figure, of the foot line
   (`healthBarBelowFeet`). Both are whole world pixels from the bar's own snapped position, so the pixel phase holds.
2. **The bar moves under the feet only when the slot over the head really lies on another figure** (at least half the
   bar's own area, weighted) **and the slot under the feet covers less**, by a margin of a quarter of the bar's area.
   Cover is measured against each other figure's body envelope (`actorBodyBounds`), narrowed to the middle 60% of its
   width where the art is, with the top 40% (head and shoulders) counting three times. The slot must also stay inside
   the visible canvas and not collide with a bar already placed. The first condition keeps a wide boss bar whose tip
   only touches a shoulder (the Driller beside Bo) over the head, where the eye looks for it.
3. **It goes back over the head only once the slot over the head covers less than a quarter of a bar**, or once the
   slot under the feet becomes the worse of the two (someone stepped into the cell in front). Moving at a half and
   returning at a quarter makes a band, so a neighbour's idle pose cannot flip the bar. While the bar is under the
   feet, the slot over the head is judged at the lowest it has sat, measured from the figure's own feet: a figure's own
   idle pose moves that slot (the Driller's by 17 px, low enough to cover Bo's head in one pose and clear it in the
   next), and judging the low pose stops the bar flipping with the bob, while the distance from the feet still follows
   a figure that walks.
4. **A bar that touches no other figure is exactly where it was**, and so is every bar when the renderer passes no
   figures. The existing stagger (bar on bar) is unchanged and runs first.
5. **A damage number still rises from over the head** (`barTops` keeps the over-head position when the bar is under
   the feet), so the number stays with the face it belongs to and is never under the figure.
6. **Both backends pass the same inputs** (Canvas in screen space, Pixi in world space), so board-correctness parity
   holds.

## Consequences

- In a column of two, the front unit's bar sits under its feet and the back unit's bar stays over its head. Nothing
  covers either figure.
- In a column of three, the middle unit's bar stays over its head across the back unit's legs, because the slot under
  its feet would lie on the front unit's head, which is worse. The front unit's bar goes under its feet. This is the
  least-bad case the two slots allow. A third slot (beside the head) was rejected: it reads as belonging to the
  neighbour.
- `actorSilhouette.test.ts` stages these cases and counts the bars lying on another figure's body.
