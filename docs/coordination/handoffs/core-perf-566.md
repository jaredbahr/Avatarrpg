# Core performance guard (#566)

Owner: continuous gameplay quality, `root/core-perf566-20261110`.
Branch: `codex/core-perf-566`; initial main `30815ebb`, rolled forward to
`bc87b6e0`, then `25c5d611` before publication as main advanced.
The initial tested commit `937048f6` and its passing CI evidence are retained.
The original calibration and frozen ceilings remain unchanged.
[Verified pre-edit claim](https://github.com/jaredbahr/Avatarrpg/issues/566#issuecomment-6768440905).

Measure all four tied-largest current combat maps, six-move reachability,
meaningful opposite-corner paths and complete enemy activations in the largest
actual six-player roster. Use the real grids, surfaces, props and reducer.
Prepare actors through public commands; do not force turn markers or stats.
PR #450 has merged. Include the largest registered top-down logical board,
Ba Dan (24 by 16), using the same terrain-query policy and separate new-case
calibration; its art tile dimensions are not navigation dimensions.

Calibration policy was fixed before measurement: three warmup batches, eleven
paired samples, path batches of 32 and AI batches of two. Alternate adjacent
independent-reference/workload ordering; consume outputs and reject nonpositive
or nonfinite measurements. Compare median paired ratios. Reference work must
not call the production pathfinder or AI.

Measure original-main ratios once, then freeze each case's ceiling at exactly
four times its original normalized median. Retain raw measurements and fixture
identity. Calibration is not a passing guard claim. Do not automatically
recalibrate, increase limits after a failure, skip cases or increase timeouts.
Require real planted multiplied work to fail the unchanged limits.

The integration owner retains `package.json`; the explicit #565 handoff allows
only the separate `bench:core` entry on this branch. Author edits are confined
to the three new benchmark files; root owns the manifest and this handoff.
Root also owns the new budget decision record, ADR 0106, as CLAUDE.md requires.
No core rules, AI, tuning, existing tests/budgets, app, renderer, art, README,
workflows, lockfile or dependency change belongs here.

Validation retained in `/workspace/avatarrpg-env/core-perf566/`:

- One original-main NON-GATE calibration capture, 2.467 s, stable source;
  report SHA256 `675690b43e7376ac68b2bc501bf91ca63588d406a69d1807bf1cc4319c6d7978`.
  All eleven normalized medians were independently recomputed. Frozen JSON
  records the report/harness hashes and exactly four times each paired median.
- Actual ten factory assemblies, maximum fourteen units: six party, Ruon and
  seven enemies in `enc_ambush` (the Cutting). Three distinct enemy kits are
  exercised through real reducer-driven activations. Enumerated factory flags
  are upper-bound fixtures, not earned campaign claims.
- First enforced typecheck/lint/format and 22 tests passed; the real eightfold
  reachability workload was rejected by the unchanged limit. Ordinary per-test
  budgets, fixed sampling and all existing assertions are preserved.
- The actual enforcing npm command passed in 2.347 s. Observed CLI median ms:
  reachability 0.115–0.142, paths 0.348–0.410, AI activations 0.669–1.421.
  A report-only bypass argument was rejected as an expected usage-error control;
  original calibration and frozen limits remained byte-identical.
- Independent source, calibration and evidence review is clear. No optimization
  or gameplay change was made. No native/device benchmark acceptance is claimed.

The rolled-forward main also passes all 22 focused guard tests and the
enforcing CLI (5.511 s combined), using identical benchmark/test/baseline blobs.
Main's replay command is preserved. Initial source/CI evidence is retained
separately; its passing run is not substituted for the updated-head gate.

The supplemental capture measured only the two new cases on unchanged merged
main `25c5d611` (stable, 1.491 s; calibration, not a guard pass). Ba Dan is
24 by 16 logical cells, with spawn (3,7) and a legal 25-step/cost-25 path
from (2,1) to (20,15). Median CPU milliseconds were 0.046 for reachable6 and
0.378 for the path. The frozen normalized ceilings are exactly four times
9.956649267866029 and 32.41192900675779 respectively. All original eleven
case limits and their capture provenance remain unchanged.
Supplemental report SHA256:
`881e0b05545ccdb8aef55a472ae23327e7fe1d1f8ce3a55d06f3158e91d613c9`;
calibration harness SHA256:
`ae7dd67a165fd72365cfaf3570d8bc69fb76af64935c3b4b09858f04bf5d00c8`.

All 27 focused guard tests and the actual enforcing 13-row npm CLI passed
together (6.967 s, stable). The unchanged eightfold real-work negative control
was rejected as expected; no limit, timeout or existing assertion was weakened.
Independent supplemental source/calibration review is clear.

Publication requires exact clean final-head `npm run ci:local`. Report that
result, actual hosted jobs/skips and remaining gates in the draft PR. The
supplemental top-down capture measures only the two new cases on exact main
`25c5d611`; its provenance and ceilings are separate from the original eleven.
Do not treat the Node regression signal as native/iPad responsiveness or physical
acceptance.

Keep DRAFT. No merge, deployment, dispatch/rerun, install, paid request,
generated asset or security/access change is authorized by this handoff.
