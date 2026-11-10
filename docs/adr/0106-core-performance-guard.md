# ADR 0106: Paired core performance regression guard

**Status:** proposed, issue #566, 2026-11-10.

## Context

Reachability, pathfinding and complete enemy activations can regress without
changing their results. Absolute timing limits also vary with a busy CI runner.
The issue requests a generous same-process regression signal before optimizing
anything. This guard changes no gameplay rules or shipped resource budget.

## Decision

Measure the four tied-largest combat grids, the largest registered top-down
logical board and representative enemy kits in the largest actual six-player
factory roster. Use real navigation grids, surfaces, climb costs and reducer
commands. Terrain queries explicitly ignore people; they are not walk replays.
Use meaningful six-move results and substantial legal opposite-corner paths.

Pair each fixed-work batch with an independent blank-grid BFS or spatial-search
reference. The reference calls no production pathfinder, planner or reducer.
Alternate adjacent reference/work order, consume deterministic checksums and
reject nonpositive or nonfinite timings without a denominator floor. Prepare
and validate immutable fixtures outside the measured batches.

The preregistered policy is three warmup batches, eleven paired samples,
32 queries per terrain batch and two activations per AI batch. Compare the
median of paired work/reference ratios. Freeze each ceiling at exactly four
times its one-time calibration median. There is no automatic recalibration,
report-only CLI option, skip, retry or timeout increase.

The original eleven combat cases retain their calibration on main `30815ebb`.
PR #450 merged during preparation, so the two Ba Dan terrain cases receive a
separate supplemental capture on main `25c5d611`; original case limits and
provenance stay unchanged. New boards require separately reviewed coverage and
calibration rather than replacing an existing case's measurement.

The ordinary Vitest suite enforces the complete frozen matrix. The standalone
`npm run bench:core` command reports measurements and enforces the same limits.
A real multiplied workload must fail the unchanged ceiling; numeric controls
check paired load scaling and invalid or incomplete measurements.

## Consequences

Same-process normalization reduces shared load sensitivity; it cannot remove
scheduler noise or prove iPad responsiveness, rendered FPS or physical-input
acceptance. Raw CPU milliseconds remain diagnostics. Native/device gates stay
separate. A failure requires preserved evidence and investigation, not a larger
ceiling. Any justified optimization belongs in a separate change with unchanged
behavior and regression controls.
