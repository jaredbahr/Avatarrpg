# ADR 0105: Cover from anything between the attacker and the defender

**Status:** accepted, 2026-11-06 (issue #435).

## Context

Cover used to be a property of the ground a defender stood on: `hasCover` read the defender's own cells
(the `cover` flag that props bake into the tile, or a surface that grants cover) and nothing else. A
water barrel beside the defender gave nothing, and since the barrel blocks movement nobody could stand on
it either, so its `grantsCover` was dead weight. Characters never gave cover at all.

The owner, 2026-11-06 (ADR 0104, question 6): "yes items, characters, walls, etc provide cover. It's
important because it creates the complexity of the gameplay."

## Decision

A ranged attack takes the cover penalty when something stands **between** the attacker and the defender,
on the defender's side, in addition to the defender's own ground.

- **The screen cell.** For each defender cell, the screen is the last cell of `lineBetween(origin, cell)`,
  the line sight already walks. It is always the one neighbour of the defender's cell that the shot passes
  through: the orthogonal neighbour for a straight shot, the diagonal neighbour for a diagonal shot, and
  wherever the line's tie-break puts it for anything between (a shallow angle ends orthogonally). The two
  corner cells of a diagonal shot never screen, even both together; the line slips between them exactly
  as sight does. `origin` is the firing cell that hit elevation already reads (the attacker's anchor where
  none is known). A two-tile shot's middle cell is beside both and counts.
- **What screens.** The screen cell counts when it is a cover tile (a cover prop such as a water barrel or
  a cabbage cart, a `c` cover tile, a rubble surface), a sight-blocking tile (a wall, a tree, a solid prop; only a
  shot that does not need sight reaches a defender behind one), or holds a living character other than the
  attacker and the defender, friend or foe. A character gives exactly the penalty a cover prop does
  (`tuning.coverPenalty`, 20); the balance report gave no reason to differ. A downed character does not
  screen. A fence (`F`) is cover: low timber you can see and shoot over but not cross. Pits, deep water
  and braziers do not screen: they carry no cover flag and do not block sight.
- **Never screens.** The attacker's own cells, so a size-2 attacker firing from its far cell is not behind
  itself, and the defender's own cells, so a boss's near column does not shelter its far one. A screen on a
  lower tier than the defender's cell does not count, unless it blocks sight: a rock at the foot of a bench
  does not shelter the figure standing on it.
- **The 2x2 boss.** As a defender it keeps the half-footprint rule: it is covered once half its cells
  (rounded up) are covered, each cell judged on its own ground _or_ its own screen. As a blocker every one
  of its `occupiedCells` screens.
- **One penalty, never two.** Own ground and the screen are a union per cell, so a defender standing in
  cover behind cover is covered once.
- **Lobbed.** An ability that does not need line of sight (`requiresLineOfSight: false`) ignores cover
  entirely, its own ground and between, as its card's "Ignores cover" chip says. It arcs over the screen,
  so it gets no plunging bonus either. Every caller passes `!ability.requiresLineOfSight`.
- **Unchanged.** Melee (adjacent) attacks ignore cover. Plunging fire still halves the penalty; elevation
  still applies. The numbers in `content/tuning.ts` do not move.

### One function, everywhere

`hasCover(content, grid, unit, square, source)` takes an optional `CoverSource` (`origin`, `attacker`,
`units`); `hitBreakdown`, `hitChance`, `averageDamage` and `rollHit` take the board's roster as a trailing
`units` argument and pass it through. Without a roster only the grid screens.

- **Preview and reducer.** `previewAbility` passes `battle.units`. `resolveAbility` snapshots the living
  units once, before any effect, alongside the struck-unit snapshot it already took, and every roll of the
  ability reads that snapshot. So a bystander that one target of a blast kills, or that a shove in the same
  ability moves, still screens every roll of it, exactly as the preview promised.
- **AI.** Attack scoring (`averageDamage`) and the threat estimate (`hitChance`) pass `draft.units`, so a
  screened target is worth less and a screened tile is safer. The position score pays the flat
  `weights.cover` for cover between on the line from the nearest opponent's nearest cell, never in melee,
  and never on top of standing in cover. The gate-off (legacy 2x1) score keeps its anchor-only own cover and
  adds `hasCoverBetween` beside it.
- Nothing consumes RNG; the rule is arithmetic over the grid and the roster.

## Consequences

- A cover prop beside the defender on the shot's line now shields it, which is what its `grantsCover`
  always claimed. `damage.test.ts`'s barrel case was rewritten from "no cover beside a barrel" to "cover
  behind a barrel, none beside one".
- Lines are not symmetric under Bresenham's tie-break, so on a knight's-move angle A can be screened from B
  while B is not screened from A. That is the same line sight uses, and the preview always shows it.
- The quarry checkpoint pins (`scripts/e2e/quarry-checkpoints.test.ts`) move, because the AI now plays
  differently; every route still arrives at the same node, level and XP.
- The Grumbler fight moved out of its win-rate band at 3 and 6 players (78.8% to 87.5%, 81.3% to 93.8%).
  The owner chose to retune it as its own balance issue rather than here.

## The owner's answers (2026-11-06)

1. Lobbed attacks ignore cover, so the "Ignores cover" chip is true. Today only Air Scooter, a dash, needs
   no sight; the rule is in place for the first lobbed attack.
2. Fences give cover.
3. Retune the Grumbler separately.
4. Characters give the same cover as props, with no half cover.
