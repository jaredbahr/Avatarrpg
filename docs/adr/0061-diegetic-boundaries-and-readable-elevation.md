# ADR 0061: Diegetic boundaries and readable elevation

**Status:** accepted, 2026-09-28. §5's lift, faces, shadows, ramps and tier
tint and §6's picking are implemented by ADR 0065, which sets the lift at 0.25.

## Context

The grid used to end because `inBounds` said it did, even where grass, road or
dirt visibly continued to the rim. Wide roads could leave a map through several
cells while only one cell triggered their route. Elevation had the opposite
problem: tiers existed in the rules and gave ±10 accuracy per tier, but their
0.06-tile lift and mostly south-facing grey band did not reliably read as
height. Walkable tier-0 and tier-2 cells could also meet with no movement rule.

The demo-map plan makes the walkable footprint, its exits and its ledges agree
with what the player sees. Jared approved its decision gate J1–J5 on
2026-09-28: the elevation rules, obscurement, the map footprints with the
Cutting as Option A, and the Ba Dan structure. M1's edge data and validator,
M2's multi-tile exits and E4 climbing are already implemented; the remaining
elevation rules and presentation in this ADR are the accepted direction, not a
claim that they are implemented.

## Decision

1. **Every map edge has a diegetic explanation.** A border cell is one of: an
   in-grid barrier, a walkable cell whose exterior band draws a physical
   barrier flush with the rim, or an exit mouth whose path visibly continues.
   `MapDef.edges` records inclusive spans by `north`, `south`, `east` or `west`
   and labels each `barrier`, `band` or `exit`. The M1 validator in
   `src/content/schemas.ts` reports every walkable border cell covered by
   neither an exit nor an edge declaration, rejects malformed spans, checks a
   connected walkable footprint, and reports adjacent walkable cells whose
   tiers differ by two or more. A map opts into errors with
   `edgeContract: 'enforce'`; unconverted maps report warnings.
2. **The shared legend supplies the boundary vocabulary.** In
   `src/content/maps/legend.ts`, `X` is an opaque, blocked tier-2 wall (a rock
   face or cliff); `W` is blocked deep water that does not block sight; `G` is
   an opaque barred timber gate; `R` is permanent rubble on a tier-1 sand
   bench; `F` is a blocked low fence or rail that does not block sight; and `U`
   is opaque blocked undergrowth. `S` is the tier-1 stone ramp used by E4.
   These keys reuse `TileTemplate` and existing terrain and surface rules; they
   do not introduce map-specific rule branches.
3. **An exit mouth may be wider than its anchor.** M2's optional
   `MapExit.area` lists every cell that takes the same route; absent it, the
   exit remains the single `pos` cell. `pos` stays the authored anchor and must
   belong to the area. Areas must be non-empty, walkable and non-overlapping.
   `exitCells` and `exitAt` in `src/core/story/world.ts` are the shared rule, so
   stepping on any listed cell takes the exit and every listed border cell
   satisfies the edge contract.
4. **Cliffs read according to their screen-facing edge.** An `X` along a back
   edge (north or west in the oblique board) is a rock mass rising behind the
   playable footprint: show its top/rim and the face toward the board. Along a
   front edge (south or east), it is the lip of a drop: show the exposed face
   descending outside the footprint, without suggesting a walkable shelf
   beyond it. Interior `X` runs follow the same near/far rule. Only exit spans
   may leave an open continuation. Thus the same blocked tile contract works
   on every side without turning the exterior apron into a frame of unexplained
   ground.
5. **Elevation is visually structural.** Both renderers will lift each tier by
   about 0.2 tile, draw full cut-stone faces on exposed south/east sides, lit
   rims on north/west sides, a feathered shadow on the lower tier, and ramps as
   steps or slopes. Tier surfaces become 4–6% lighter and warmer per tier, with
   a high-contrast token. Ink belongs only on elevation breaks; scene art must
   not cover the procedural faces (or must supply faces registered to the same
   cell edges). These are board-correctness features and therefore require
   Canvas and WebGL parity.
6. **Picking follows the eventual lift.** The planned inverse transform must
   select the topmost lifted tile under the pointer, rather than treating the
   painted top as if it remained on the flat grid. Tile-to-screen and
   screen-to-tile must remain inverse contracts in both backends, covered in
   `e2e/viewport.spec.ts` and `renderer.spec.ts`. Until that work lands, this is
   a required rendering change, not current behaviour.
7. **E1 remains the base height rule.** Every attack, including melee, gains or
   loses 10 accuracy per tier of attacker-minus-defender elevation. The final
   chance remains clamped to 5–99. The numbers come from validated content
   tuning, not literals in core.
8. **E4 climbing is implemented.** `enterCost(ctx, from, to)` adds the normal
   footing cost plus `content.tuning.climbCost`, currently **1 MP**, when the
   destination is exactly one tier higher and neither endpoint has `ramp` from
   legend `S`. A flat step or one-tier descent has no elevation surcharge. A
   tier difference with absolute value two or greater is illegal in both
   directions, including diagonals. A size-2 unit checks the corresponding
   step for both occupied cells; either illegal cell refuses the whole move,
   and otherwise the unit pays the worst surcharge once, not once per cell.
   A movement context with no `climbCost` fails closed on an otherwise legal
   climb rather than making it free. `standCost` deliberately checks only
   occupancy and footing where there is no movement edge. `Tile.ramp` is kept
   in battle saves (optional on old saves), so loading cannot silently change a
   route. The shared cost flows through reachability, saved-path validation,
   diagonal checks, exploration, AI movement, slides and dash landing checks.
9. **E2, E3, E5 and E6 remain planned with the approved values.** E2, a
   non-adjacent attack from a higher tier, halves cover's penalty from −20 to
   **−10**. E3 gives **+1 range**, once rather than per tier, when a line-of-sight
   ability with base range at least 3 targets a lower tile; dashes and
   self-targeted abilities are excluded. E5 makes a shove or pull down deal
   **3 defense-ignoring damage per tier**, never reducing the unit below 1 HP;
   forced movement up stops at the ledge, and preview must forecast by running
   the same rule on a throwaway copy. E6 replaces the flat AI height value with
   a per-tier weight: **cautious 4, support 3, aggressive 1, boss 0**. These
   rules are not active until their implementations and parity tests land.

## Rejected or deferred

- Height does not yet let a tier-2 unit see over low blockers. That needs
  blocker heights and is harder to explain in the preview.
- Elevation adds no damage bonus; accuracy is sufficient and avoids changing
  every kill threshold.
- Falls are non-lethal. A lethal push would be too punishing and would dominate
  AI scoring.

## Consequences

- A board boundary is authored and validated as terrain or an honest route,
  rather than relying on an invisible `inBounds` wall.
- Wide roads can be wide exits without duplicating route definitions, while
  their anchor remains stable for arrivals and content references.
- E4 changes movement now, in combat and exploration. Ramps are explicit data,
  two-tier cliffs cannot be crossed in either direction, and forgotten tuning
  cannot accidentally make a climb free.
- The remaining height rules and lifted picking require shared-core previews,
  Canvas/WebGL parity, and balance runs in the approved one-lever sequence
  before they can be called implemented.
