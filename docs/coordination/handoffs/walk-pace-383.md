# Ba Dan exploration walking pace — #383

Root integrates `codex/ba-dan-walk-pace-383`; SOL High workers supplied the
bounded cadence implementation, coordinated test repair and independent review.
[Claim6563027231](https://github.com/jaredbahr/Avatarrpg/issues/383#issuecomment-6563027231)
retains historical checkpoints and current milestones.

## Scope and behavior

Jared's “Walking speed is a bit slow” feedback approves a modest exploration
pace change using existing walk cels. Exploration625 replaces750ms/tile;
`STROLL_REFERENCE_MS=750` preserves brisk calibration, combat720 and the
complete resident/Mira amble at750×8/3, including ramps, settling, fades and
reduced motion. The completion helper independently estimates amble with that
reference. Rules, RNG, paths, picking, artwork and default style retain their
existing contracts.

Scope: choreography, animator, residentMotion, resident-completion helper, two
dedicated regression files, existing residentMotion test, ADR0095, CLAUDE's walk
paragraph, native fixture/config and the historical evidence dossier. New evidence remains outside Git. Preserved local candidate16b36ba7
and its bundle; merged main958ba98b as18a489c1; applied coordinated shared-test
repair as native producer5ac1e74b.

## Shared-test handoff resolved

Original source passed9new checks and native comparisons, but2old Mira
completion assertions failed because their horizon shrank with party pace.
Root requested a handoff instead of taking PR356's owned test file.
After356 merged, [release6596899788](https://github.com/jaredbahr/Avatarrpg/issues/383#issuecomment-6596899788)
authorized this integration. Its geometric deadline now uses amble's750ms
reference instead of live625 party pace, preserving geometry, fade allowance,
every assertion and50ms samples.

Current-main reproduction: **30pass/2fail** before repair; **187 focused checks
across10files pass** after it. Scoped lint/format/diff pass. Independent runtime
review found no defect or weakened test. Original184/2, new-test fixture
failures and early native nullability failure remain retained as failures.

## Native evidence and publication

Identical fixed-route fixture uses legal commands and forwards the actual
renderer view unchanged, ordinary time and natural camera following.
Current baseline67aa6c82 (src/public equal main958ba98b) passes4/4; candidate
5ac1e74b passes4/4, each Canvas/WebGL×default/world. Scheduled one-tile playback
changes about871→746ms; four tiles east about3123→2623ms. All cases retain3
distinct party seats, final leader positions, walk frames, no jog and no
browser errors. Eight complete recordings decode.
[Comparison, captures, exact identities and limitations](../evidence/383/README.md).

Full final-head `npm run ci:local` must pass before publication; the PR records
that exact published commit/tree and results. Native producer identities stay
explicit when later documentation changes the complete tree. Fresh open/closed
issue/topic searches found no competing383PR before resuming. Publish one
DRAFT with `Fixes #383`, then inspect actual hosted jobs/skips. Latest direct
user requires draft-only delivery: no ready-state, auto-merge, merge,
deployment, installation or security/access change.

Current raw evidence lives under
`/workspace/avatarrpg-env/pace-383/resume20261103/`; originals remain in the
preserved bundle and historical archive. The compact committed dossier keeps4
native captures and raw-file hashes instead of29MB old media. DeepSeek
executor/shared accounting remains unverified: no calls. No asset generation,
replacement art or portrait/default-style change occurred.

Physical iPad/Surface, accelerated-GPU performance, WebKit/Safari/PWA,
listening and owner motion/visual acceptance remain open. Chromium dimensions
and decoded software-WebGL footage do not close those gates. User tab/build
is unverified; no connected-browser/live-Pages access is claimed. Other art,
renderer and combat assignments retain their live owners.

## Current-main / eight-cel compatibility (2026-11-03)

Session `pace383-eightcel-20261103` continues the same owned draft403 and branch,
from published `30644838`. The claim above was amended and read back before
edits. Main `207c8eec` contains #411's eight-cel Kaya world walk. It merged cleanly
in merge `4e277ecd` (parents `30644838`, `207c8eec`, identical tree to the
preserved local producer `242a3891`); authored changes are
limited to the owned pace regression, native backend assertion and this handoff. Existing main source,
assets and generator output are inherited exactly. No asset is generated or
hand-edited, and the default style is preserved.

No runtime formula change is needed: native G1 keeps its 750/70 calibration;
world Kaya keeps its fitted phase per ground distance without a brisk cap.
The new regression exercises actual Animator poses and the real clip resolver
at 625 ms/tile across a six-tile route and a turn. It requires all eight resolved
walk indices and monotonic continuous phase, then checks that settling approaches
the declared passing half-cycle phase and ends at the existing boundary. The
pre-update six-cel branch produces one expected compatibility failure while its
four old pace cases pass. After the main merge, the old cases remain unchanged.

The first stop assertion incorrectly expected the final rendered cel one
millisecond before the dwell ended. That failure is retained separately. The
corrected fixture follows the established Animator stop contract: phase approaches
the passing cel, stays within the final one-millisecond interpolation bound, and
the walking pose ends at the dwell boundary. It does not claim that cel 2 or 6
was already drawn before that boundary, and changes no runtime timing or old
assertion. Focused checks and their exact results remain in the PR/claim.

Native validation compares frozen current-main production (750) and the integrated
candidate (625), using the same four-leg route on Canvas/WebGL and both
default/world profiles. It forwards real renderer views and uses ordinary time;
positions, three distinct seats, walk frames, no jog and errors remain checked.
New recordings, frame/cadence analysis, images and hashes live only under
`/workspace/avatarrpg-env/pace-383/eightcel20261103/`. They support a local rendered
motion comparison, not listening, physical input, owner style approval or an
accelerated 60-fps claim. Root owns exact clean final-head ci:local before an
expected-head nonforce update of the same draft and actual hosted-job inspection.

**The existing media-history gate remains unresolved.** The earlier approximately
1 MB dossier is still in this branch's ancestors. The owner requires clean-history
republication; this compatibility update adds no new review media, deletes no
HEAD files as a substitute for history cleanup, and uses no rebase, force push or
competing PR. Keep draft with that blocker explicit. No readiness, PR merge,
deployment, dispatch, installation, paid assistance or security change is allowed.
#409's separately released cast-pose hunk remains reserved and untouched.

The initial native launch stopped before gameplay because its recorder setting
was unset. Those setup failures remain separate. Validation reuses the existing
approved encoder profile recorded in `resume20261103/run.py`; no software,
symlink, permission or recording requirement was changed. The exact profile and
binary hash are in the external `recorder-profile.receipt.json`.

The native fixture now records `App.rendererBackend()` and requires it to match
the requested backend, preventing silent Canvas fallback from counting as WebGL
coverage. All existing motion controls and budgets remain unchanged. The initial
four-profile baseline is retained as a pre-backend-gate observation. The earlier
local CI was intentionally interrupted before this test-source change; only the
new exact final-head run can satisfy publication. Strict paired native results
and the final CI outcome are recorded in the PR and external receipts.
