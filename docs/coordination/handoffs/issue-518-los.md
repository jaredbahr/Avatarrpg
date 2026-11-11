# Issue 518: line-of-sight properties

Adds a seeded regression suite for the existing LOS contract. Runtime behavior,
content, dependencies, assets and validation settings are unchanged. The only
production-file edits correct the two misleading “symmetric” comments in grid.ts:
ADR 0105 explicitly permits destination-directed Bresenham midpoint ties.

The new file checks 2,400 random cases plus 150 cases for every CONTENT map
(currently six maps, 3,300 cases). An independent dominant-axis geometric oracle,
literal octant canaries and segment bounds constrain the raster. Coverage includes
self and eight neighbours, endpoint exclusion, interior blockers, documented
directional ties, transparent fence construction, real water-barrel prop baking,
interleaved/cache-isolated grids, and cover/obscurement traversal order.
Nonvacuity counters require clear/blocked, tied/untied, asymmetric and prop cases.

Root validation: typecheck and scoped lint passed. All 78 tests in the seven
focused LOS/grid/footprint/cover/obscurement files passed; the 3,300-case property
took 629 ms under its unchanged 10-second deadline. The first CLI attempt collected
no tests because a worker-limit flag conflicted with Vitest defaults; its error
is retained. The successful run used project-default worker settings.

Based on main 3dbe66103534137d0da40b2b7c15ef38cf746e33, branch
codex/issue-518-01a1b3cc. Issue comments 6731083236, 6731142523 and 6731232447
record the claim and ADR reconciliation. No algorithm or balance change remains,
so the conditional before/after balance comparison is not triggered.

Luna High investigated; Sol High drafted; root and an independent Luna review
checked the result. DeepSeek supplied bounded planning advice, no executable
implementation. Evidence is retained outside the repository under
D:/Codex/validation/avatar518-los-01a1b3cc. Root owns the frozen-head full normal
ci:local gate, hosted checks, publication, Ready transition and merge; their actual
results belong in the PR. No visual or physical-device acceptance is claimed.
