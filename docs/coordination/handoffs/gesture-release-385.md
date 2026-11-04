# Pointer release radius — #385

Owner: root, Improve Avatar RPG goal, bounded SOL High source worker.
Branch `codex/gesture-release-385`, base main0d4c2b93.
[Verified claim](https://github.com/jaredbahr/Avatarrpg/issues/385#issuecomment-6566829555).
Scope: gestures.ts/test, e2e/gestures.spec.ts, this handoff/evidence385. No other
open PR owns these files; no shared scene/App/renderer/core/art edits.

## Existing behavior and correction

A tap must stay inside the configured10px radius. move() checked displacement,
but pressed-phase up() emitted a tap without checking the release. The executed
API sequence down(10,10), move(15,10), up(50,10) therefore emitted a tap40px from
start. The correction checks Euclidean release distance against the unchanged
threshold before onTap. It does not synthesize a drag or camera motion.

Focused regression: on unmodified source, new tests record **3 failed/13 passed**;
after the correction **16/16 pass**. Cases cover no move samples, a near-start
last sample, diagonal displacement, inside/exact-axis/exact-diagonal boundaries,
cancellation, timer cleanup and the next ordinary tap. Existing pinch/drag/
longpress/mouse/pen cases unchanged. Initial worker-pool configuration error
(min/max mismatch) is retained separately and corrected before red/green runs.

Native regression sends synthetic PointerEvents through the actual canvas
adapter, with missing and near-start move samples, and observes party position
and camera. A real mouse-tap positive control must still walk/settle on the
same legal road tile. It does not mutate game state, clocks, HP or routes.
Synthetic pointers are not physical touch acceptance. Root will record actual
baseline/candidate native and exact clean final fullci9 results before push.

No thresholds/assertions/deadlines weakened. No install, security change,
merge/deployment/art generation. DeepSeek runner/accounting unverified: no calls.

## Native source checkpoint

Clean source producer `6a0ff5b10296a5f571e6591cb03ca2451f4127fe`, full tree
`f0ffa6887c9804116dcc00e9c31404bcc4f12973`: complete native gestures.spec.ts
**10/10 pass**, exit0/stable source/tree/harness,75.75s, one Chromium touch
worker, retries0. All nine previous cases remain unchanged: pinch, drag, wheel,
Recentre, combat framing, active-actor changes and footer/log reflow. The new
actual-canvas test also retains ordinary mouse-tap movement as positive control.

Unchanged-main native control fails the new assertion: intended stay(3,7), actual
unintended walk(7,7), exit1. Additional native probe holds(3,7) for both omitted
and near-start final move samples, then an actual mouse click walks to(7,7),
errors[]. Root inspected retained native stills. No rule/clock/camera overrides.
Independent SOL review found no actionable defect. Evidence, hashes and failed
records are linked in [the report](../evidence/385/README.md).

Required fullci9 must pass on the exact final clean head before any push; record
actual result in the PR. Hosted jobs/skips must be inspected separately. WebKit,
physical touch/pen/mouse on iPad/Surface and PWA remain open; synthetic touch
through a real browser is not physical-input acceptance. No performance/art
approval or deployment claim. Local raw traces/logs remain under gesture-385.
