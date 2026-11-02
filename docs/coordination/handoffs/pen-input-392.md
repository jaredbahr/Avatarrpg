# Primary pen input — #392

Root, Improve Avatar RPG goal, SOL High implementation and cross-review.
Branch `codex/pen-primary-input-392`, base main
`0d4c2b938f56bd5f8853323b0ea85d13b9a61ff2`.
[Claim verified before edits](https://github.com/jaredbahr/Avatarrpg/issues/392#issuecomment-6569024111).
Scope: pointer.ts, new pointer.test.ts, new pen-input.spec.ts, this handoff.
All25 open/draft PR file scopes were inspected; none overlap. Topic searches
found no duplicate. PR387's recognizer/shared gesture spec, all scenes, styles,
App, rules, story, assets and security remain untouched.

## Behavior

Root reproduced actual production main: a standards-shaped pen eraser down/up
(button5/buttons32 then release0) walked Ba Dan from3,7 to7,7. Mouse secondary
button2 stayed at3,7; ordinary pen tip0 walked7,7, with no page errors. These are
controlled browser events, not physical stylus acceptance.

The adapter's existing mouse non-primary press guard now also covers pen, before
capture and recognizer entry. Tip/mouse primary, touch, move/up/cancel/leave,
contextmenu, wheel and teardown keep their existing paths. This does not define
new pen gestures, eraser features or chord behavior.

## Producers and results

- Unit baseline `80470d11a56ec40033c33f9a5458a6cd7cfab326`: exact new11 adapter
  cases against unchanged runtime, **4failed/7passed**, exit1/stable. Same tests
  on candidate `3241329f525336e7fd8bcf3fef1dffc4ba34a19a`: **11/11passed**,
  exit0/stable. Observable capture/release/tap checks cover eraser/barrel, mouse
  secondary buttons, all primary kinds and recovery without a phantom pinch.
- Corrected native source/test producer
  `d113ae5f506ad891ed143e8f2e5a86873f897d1a`, complete tree
  `1e06834029aac35afe71e0559a86fa3ad066fdae`: **8/8passed**, exit0/stable,
  196.05s, one installed-Chromium worker, zero retries, original60s case/10s
  expectation limits. Canvas/WebGL × landscape1368x912/portrait834x1194 touch
  profiles at DPR1. Later handoff-only changes preserve src/public/e2e exactly.
- The corrected fixture fails all8 cases against the unchanged runtime: eraser
  changes full exploration state or selects a combat pending target. Exit1/
  stable,117.36s, no setup failures. Baseline runtime80470d11 differs frommain
  only by the unit-test harness; Vite stamps that actual revision, so its whole
  dist is not represented as byte-identical to the original0d4 build. Runtime
  source/public are unchanged; dist hashes stayed stable throughout each run.
- Candidate checks both eraser and barrel, then proves a normal tip walks to a
  legal visible road cell or selects a legal Move target and moves after actual
  UI Confirm. Exploration uses actual CONTENT and immutable product previewWalk;
  combat reads the mounted scene's actual reachability. No fabricated grids,
  stats, positions, flags, outcomes or game state. Baseline fails at eraser first;
  it does not separately execute later barrel or positive-control branches.
- Scoped format/typecheck/lint/diff passed. Each worker cross-reviewed the
  other's files; root reviewed the combined change. No actionable findings.

## Preserved failures and remaining gates

Initial native fixture3241329f: six genuine action failures and two portrait
exploration setup failures because fixed7,7 was outside the visible canvas.
Candidate attempt was interrupted during initial setup/build after classifying
that error; no pass claimed. The corrected fixture selects an authored reachable
road whose measured point actually hits the canvas, retaining all no-action,
visibility, positive-control assertions, portrait cases and budgets. Original
reports and interruption record remain preserved. Before c82c72b2, authoring
typecheck caught unsupported Vitest toHaveBeenCalledExactlyOnceWith; equivalent
supported call-count and argument assertions replaced it before final green.

Raw logs/receipts/traces, source reviews, build provenance, screenshots/probes and
hash manifests remain under `/workspace/avatarrpg-env/input-discovery/`. The PR
records actual final clean-head ci:local9/9, publication tree equality and hosted
jobs/skips; none is inferred from these focused/native results. Full9 must pass
before push. If API metadata changes the published commit identity, attribute
local execution to its real producer and verify complete tree equality.

Physical pen/driver, Surface/iPad input, WebKit/Safari, PWA and final visual/
performance acceptance remain open. No merge, deployment, dispatch, install,
purchase, security/credential or art change. DeepSeek runner/shared accounting
remain unverified; no requests. Keep corrections on the same published branch
with its expected remote head; never force-push the divergent local graph.
