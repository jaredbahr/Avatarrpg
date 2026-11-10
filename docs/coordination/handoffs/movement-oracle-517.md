# Movement oracle — issue #517

Scope: new test `src/core/rules/movement.property.test.ts` only; runtime rules,
content, existing tests, dependencies and assets remain untouched. Main-owner
claim was recorded and independently verified before editing. Based on main
`94cac3a0`; the unrelated title Settings fix is excluded.

The suite uses 1,024 reproducible tiny boards and 32 contexts from actual Forest
Road, Quarry Gate, Cutting and Quarry Floor encounters. Public battle factories
bake authored props; BattleDraft supplies allied/enemy occupancy, excluding the
mover. Every context's blocked set is cross-checked against independently
enumerated footprints of all living other units. Tiny scenarios vary footprints, tier bands, ramps, blocked tiles,
surfaces, occupancy and budgets, including zero. Coverage counters require actual
movement, both body sizes, allied/enemy blockers, weighted/diagonal steps,
transient straddles and baked solid props.

The oracle uses dense minimum-scan Dijkstra with numeric distances, independent
of the production sorted frontier and stored paths. Its transition model uses
standCost on a height-flattened grid for the footprint's surface/occupancy base,
and checks that shared primitive against independently enumerated raw tiles at
every anchor. It independently pairs original footprint cells for cliffs,
ramps and worst climb surcharge. Diagonals require both orthogonal transitions,
without charging their costs or requiring flat standing positions. Original
standCost filters final stops, while mixed-tier anchors remain graph vertices.

Every reachable entry is compared for membership and minimum cost, then every
returned path is walked using independent edges. Every in-bounds findPath goal per
context is checked for existence, endpoints and minimum cost without requiring a
specific tied route. This includes unreachable anchors and the self special case.
Start remains in reachable; returned paths omit the start. Fixed
canaries pin transient straddling, stop filtering, one blocked/cliff diagonal
guard on either side, budget boundaries, worst surface/climb costs, ramps,
two-tier cliffs, zero-budget/self paths, and all eight directions on open ground
with a literal expected set independent of the shared neighbors helper.

Worker did not run tests, builds or native tools, install dependencies, commit,
or mutate GitHub. Root owns formatting/type checks, measured focused runtime
(target below 15 seconds), mutation sensitivity and the final validation gate.

Root validation: the focused suite passed 31/31 tests (this new file plus the
unchanged grid and footprint suites); the 1,056-case property took 3.006 s under
its original 15 s deadline. Independent SOL review found no material issue.
Five Vite transform mutations, applied only in memory outside the worktree,
each failed the assertions: allowing corner cuts or non-flat stops, ignoring
climb costs, surface costs or occupied cells. Their original logs and source
stability receipts are retained under
`/workspace/avatarrpg-env/movement-oracle517/`; no production file was edited.

Root freezes the exact final commit before `npm run ci:local` and publishes only
if that clean head passes. The PR and same before-edit claim record final
commit/tree, full CI and hosted leaf-job results/skips. This is test coverage;
it does not change runtime behavior or claim new rendered/physical-device
acceptance. DRAFT only; no merge, dispatch, deployment, installation, art or
security change. DeepSeek executor/accounting remains unverified: no requests.
