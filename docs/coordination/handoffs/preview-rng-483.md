# Preview and AI scoring RNG invariants (#483)

Owner: Codex, branch `codex/preview-rng-483`, based on main
`1c273d2a004456679d3cdb5949773b5e864eaeff`.
The [live claim](https://github.com/jaredbahr/Avatarrpg/issues/483#issuecomment-6717864404)
records scope, exact validation identities and publication status.

The preview and AI scoring contracts require that inspecting a possible action
cannot change the next random outcome. Checking only `GameState.rng` misses an
accidental draw through the mutable `RngCursor` retained by `BattleDraft`.
The new property checks that actual cursor and the original state and draft
battle independently. It reads abilities from the content index so new kits and
future ability IDs join the workload automatically.

The current corpus uses all four encounter maps and two seeds. Each fixture
plays up to 18 real AI turns, retaining the last active battle if it would end.
Caster setup prefers an existing owner, then the matching element; if needed it
explicitly grants the queried ability on a clone. This covers later discipline
and enemy kits without claiming that the fixture earned that progression.

Every board tile is independently classified with `resolveAim` and
`isValidTarget`, then checked against `targetableTiles`. Each legal raw tap
reaches both queries. Illegal probes cover every available in-bounds rejection
reason and two off-board coordinates. Self actions use their canonical occupied
cells; their accepted off-board probes are counted separately, because the
validation API deliberately ignores the coordinate for self actions.

After fixture generation, temporary tripwires reject cursor-method and direct
functional RNG draws, including draws from newly created preview cursors. They
restore in `finally`. Each call also checks the actual retained cursor and game
RNG state. Frozen cloned graphs and per-ability structural comparisons protect
both original state and live draft; the AI's intentional wall-target scratch
cache remains mutable. Deliberate draw and nested-mutation controls prove the
oracles catch those failures. Legitimate `-Infinity` AI scores are permitted.

Scope is regression coverage only: a new property test and this handoff.
Production rules, content, dependencies and existing tests remain unchanged.
The explicit workload time bound remains below 20 seconds. Mutation controls
must demonstrate that the oracle catches unintended draws and state changes.

Validation receipts and any diagnostic failures remain outside Git under
`/workspace/avatarrpg-env/preview-rng483/`. The issue claim and draft PR carry
the final clean commit/tree, exact `npm run ci:local` result and actual hosted
leaf-job results, including skips. Tests do not establish graphical, physical
device or whole-game acceptance. Keep the PR draft; no merge or deployment.
