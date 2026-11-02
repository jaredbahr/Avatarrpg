# Save-file import lifecycle — #388

Owner: root, Improve Avatar RPG goal, bounded SOL High implementation/review.
Branch `codex/save-import-lifecycle-388`, base main0d4c2b93.
[Verified claim](https://github.com/jaredbahr/Avatarrpg/issues/388#issuecomment-6567167857).
Scope: SaveMenu.ts, e2e/saves.spec.ts, this issue's handoff/evidence. Existing23
open/draft scopes exclude these files. Related historicalPR20 covers quota/schema
recovery, not stale request completion. Other App/Dialog/store/core/art files untouched.

## Reproduction and correction

A valid import could finish after Load was closed and replace the resumed game.
Root reproduced actual production UI using an App-written valid save and real
file chooser/FileReader, deferring only I/O: after Close/Resume, zero dialogs,
currentseed2500703268 changed to old72779210, errors[]. No game state, clock,
load result or schema was fabricated. This demonstrates a controlled slow-read
race, not device-specific incidence.

SaveMenu now tags each import request, invalidates it on Close, and ignores
closed/superseded results before both warning and adoption. Ordinary latest
imports retain the existing parser/validation/adoption/session path. No new
storage architecture, dialog framework or confirmation flow.

Three real-browser regressions cover closed valid import, olderA completion
while newerB is pending, and stale invalid-file warnings after resume. The B
completion is the normal-import positive control and compares full state/session.
They queue the original FileReader.readAsText and await real loadend; no fake
read result. Negative toast snapshots are immediate, so expiry cannot make the
baseline pass. Existing saves cases/assertions/deadlines remain unchanged.

Source worker typecheck/scoped lint/diff checks pass. Baseline red/candidate full
native suite and exact final clean-head ci:local9/9 are required before push;
record actual results with exact producer/tree identities. Synthetic file
selection/controlled I/O in a real browser is not physical file-picker/device
acceptance. WebKit, physical iPad/Surface and PWA remain separate gates.

No merge, deployment, install, security/art/core/rule change. DeepSeek executor/
accounting unverified: no requests. Keep corrections on this same eventual draft
PR branch. Avoid PR386's known main Escape issue in this fixture: use Close.

## Native evidence checkpoint

Clean producer `0f161fca8faccaf8511230d410fb75324b8ec000`, complete tree
`94ccddc5de889b8069cc0ad9339ae931e7a2497b`: full saves.spec.ts **11/11 pass**,
exit0/stable source/tree/harness,58.57s, one Chromium touch worker, retries0.
Eight existing storage/recovery/layout/toast cases remain unchanged. Baseline
new lifecycle cases **3/3 fail**, exit1: closed valid result replaces full game/
session, olderA overwrites before newerB, and closed invalid result warns.
Actual failures retained; no assertion, deadline or retry change.

Additional actual UI probe retains currentseed2500703268/state after the closed
read, errors[]; baseline had changed it to72779210. Root inspected the retained
Current Bo before/after stills. File bytes, chooser and reader are real; only I/O
completion is controlled. Latest-request B still imports its full state/session
through ordinary adoption in the native positive control. Independent review
found no actionable defect. [Evidence](../evidence/388/README.md) binds producers
and hashes; raw local traces/logs remain under import-388.

Final exact-head fullci9 must pass before push; record the actual final result
in the draft PR. Later evidence-only changes retain this producer's src/public/
e2e. Hosted exact-head jobs/skips, WebKit, physical file-picker/device/PWA
acceptance are separate. No issue-completion/readiness/merge/deployment claim.

## Formatting gate corrected; final fixture replay

First fullci on clean ac614a5c failed step3 format:check before the unit suite.
Prettier corrected only releaseImportRead call wrapping; no assertion, deadline
or runtime source changed. The failure receipt remains in the evidence.

Final formatted clean producer `5ccb1dd932a774d417b5adc4ec09d68c6fdda5a3`,
full tree `d24337dfaa6910c1ffcd20661f42ac0c726404bd`: full native **11/11 pass**,
exit0/stable,60.24s, zero retries, under uniquely named native-formatted outputs.
Original0f native proof and failure records remain retained. This newer fixture
is the exact e2e source retained by subsequent evidence-only commits; runtime
and public bytes also equal the original UI probe producer.

A fresh exact final clean-head full9 is required before publication. Do not call
the failed initial run green; record actual corrected gate result in the PR.
