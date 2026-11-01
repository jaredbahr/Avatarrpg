# Forest Road #379 audit handoff

Updated 2026-11-01 UTC. Owner: Codex `goal-intake-20261031` root, with bounded
SOL High source/fixture/visual reviewers. Claim:
<https://github.com/jaredbahr/Avatarrpg/issues/379#issuecomment-6552246292>.
Branch `codex/forest-road-polish-379`, based on merged main
`0d4c2b938f56bd5f8853323b0ea85d13b9a61ff2`.

## Outcome and scope

The audit records Ba Dan arrival, real exit/Forest walk and narration, ambush,
three party turns, unstaged victory, aftermath and real quarry-gate arrival.
3/4 native viewport/backend cases completed the full route. The issue stays open: route success and an audit do not establish
final area/style/owner/device acceptance.

Owned files are the dedicated `e2e/forest-road-polish.review.ts`,
`docs/demo-flow-playtest-forest-road.md`, curated evidence under
`docs/coordination/evidence/379/` and this handoff. No game, rule, balance,
art/public, generated output, shared fixture, backend, timeout, retry, security
or workflow source changed. The confirmed small code gaps are already owned by
existing PRs; no duplicate patch was justified. Source leads for reload flock
and lower-mouth dock routing remain unverified, not new findings.

See the [audit](../../demo-flow-playtest-forest-road.md) for severity, native
timestamps, owners and explicit gaps. The new north-west apron art handoff is
[#381](https://github.com/jaredbahr/Avatarrpg/issues/381). Existing #328/#329/
#333/#334/#336/#341 owners retain their camera/HUD/overlay fixes; #342 effect
readability is not accepted by a rules-only exercise or victory-dimmed still.
Quarry continuation art belongs to #345/#344. East-shelf composition stays an
owner style question under #379 and deferred #343; no geometry defect is proved.

## Source and evidence identity

Native capture producer: local `63626257654b90f81c6b3871e7575b9736e890df`,
tree `9d4dd61705e1ad096001c223ebb558fc9d790a6e`. Its game/public trees equal
the main base. Later publication files add only audit/media/provenance/handoff;
consult the PR for exact final tested/published commits and complete-tree match.
The wrapper verified before/after capture source, helpers, harness, dist, runner
and clean status were stable. The failed corrected fixture has null
`finalProvenance`; the wrapper identity check is separate from successful route
completion.

| Profile        | Viewport / DPR | Actual exit |   Runtime | Route / selected attempt                                                     |
| -------------- | -------------- | ----------: | --------: | ---------------------------------------------------------------------------- |
| desktop-canvas | 1280×800 /1    |           0 |  168.19 s | passed; run1-desktop-canvas; native stills and full-route video              |
| ipad-canvas    | 834×1194 /2    |           0 |  215.34 s | passed; run1-ipad-canvas; native stills and full-route video                 |
| desktop-webgl  | 1280×800 /1    |           0 |  959.40 s | passed; run1-desktop-webgl; native stills and full-route video               |
| ipad-webgl     | 834×1194 /2    |           1 | 1813.28 s | failed; run2-ipad-webgl-stills; native stills; extra full-route recorder off |

The corrected portrait WebGL attempt also failed: actual exit 1 / 1813.28 s,
unchanged 1,800,000 ms whole-case timeout during fourth-party-turn handoff settling.
It recorded 14 beats, including the first three completed party turns, and six
accepted commands; victory, aftermath and quarry arrival were not reached. The
page/context-closed error follows the case timeout. Runtime page/console errors
were empty, which does not make this a pass. No third attempt, larger budget,
source workaround or performance/device acceptance is claimed. The corrected
[failure record](../evidence/379/corrected-portrait-failure.md) and
provenance retain the actual failure and trace/context hashes.

The table selects one actual attempt per profile. Preserve the original
portrait WebGL failure: actual exit1, 30-second Ready-click action at the second
handoff, partial native beats and trace/context. The one corrected attempt turns
off only portrait WebGL's continuous recorder, preserving stills, canonical
tracing, DPR, assertions and all budgets. This is not proof of a recorder-only
cause, a green original run or portrait motion/performance acceptance. Build
source/fixture/helper hashes match; full dist hashes differ across the fresh
build and remain bound individually. Both actual attempt records are durable in
provenance and the original failure summary.

Across the 3 completed profiles, the 31 accepted party-command/event traces, terminal battle and retained 100-entry victory logs match exactly. Canonical commands and retained logs are included in provenance so their hashes can be recomputed. This is a fixed-seed/variant observation, not an invented uncapped campaign log or all-seed balance claim. Core/content/public game trees are unchanged from main; the final local gate retains the original progression and balance checks.

Native stills are lossless backing-size conversions with exact decoded RGBA
proof. The single small clip is an unchanged-time continuous native Canvas
segment; its codec is lossy and raw-video PTS is distinct from the beat clock.
See [provenance and executable snapshot](../evidence/379/README.md). Original
videos/PNGs/full-state logs, every outcome and the initial pre-browser launcher
typo remain in `/workspace/avatarrpg-env/review-379/`. Those local paths are
retention locations, not cross-machine links.

## Validation and next actions

Capture production build passed with before/after source/helper/harness identity
and actual exit 0; source fixture formatting/ESLint passed. Final exact committed
head must pass the full nine-stage local gate before any publication. Final
receipts, immutable tree identity, remote head and actual hosted jobs/skips are
reported in the draft PR and same ownership claim. An earlier native capture
does not silently cover later runtime/fixture changes; this milestone adds no
such change after the captured fixture.

Root retains correction/review ownership; do not take over a stale claim or edit
another worker's overlapping camera/HUD/backend/art scope without coordination.
Apply existing owned fixes in #348 order, then repeat the relevant visual review
on the integrated game. Art #381 needs a bounded existing-pipeline owner and
preserved registration/density/budgets; no generation/repaint/offset/shadow
workaround was performed here. Physical Surface/iPad, Safari/WebKit/PWA,
listening and owner visual acceptance remain open.

Publish as a draft and leave #379 open with factual remaining gates. No manual
dispatch, readiness, auto-merge, main merge, deployment, purchase, paid
generation, new service or release-version bump is part of this milestone.
