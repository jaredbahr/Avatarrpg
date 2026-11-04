# Recover interrupted pointer capture — #396

Root, Improve Avatar RPG goal, SOL High implementation and cross-review.
Continue existing draft PR393 and its published branch
`codex/pen-primary-input-392`; this is a correction after published parent
`101b53fbf7993e58c88e0222a02779997d18a65d`, preserving #392.
[Claim verified before edits](https://github.com/jaredbahr/Avatarrpg/issues/396#issuecomment-6571023066).
Local correction: `/workspace/avatarrpg-env/capture-discovery/source`, branch
`codex/pointer-capture-396`. Only pointer.ts, existing pointer.test.ts, new
pointer-capture.spec.ts and this handoff change. All27 open/draft scopes were
checked; the adapter/unit ownership is already this root's PR393. No competing
PR, recognizer/shared gesture changes, scene, style, rules or art changes.

## Observable behavior

On a real mouse drag in Ba Dan, release of its actual browser pointer capture
followed by mouseup outside the canvas left the recognizer dragging. Hover then
panned the map and the first normal click was swallowed; the second click
worked. Root recorded trusted down/gotcapture/lostcapture with button held,
then trusted outside pointerup with buttons0. The probe used standard
`releasePointerCapture` to model an interruption, not a synthetic loss event
or a claimed spontaneous physical-device failure.

The adapter now forwards lostpointercapture to existing recognizer cancellation.
It cancels a pending long-press timer and interrupted drag without creating a tap
or drag completion. Normal pointerup still finishes before the browser's later
capture-loss notification. Existing pinch cancellation, unrelated-pointer rules,
pen filtering, contextmenu, wheel and teardown remain in place.

## Reproducible evidence

- Unit baseline `3baf3e1277c250356070fa7ba0fbbd81e2a9b98b`: same new16 test
  bytes against published101b adapter, **2failed/14passed**, exit1/stable.
  Genuine failures were the pending long-press and continuing hover drag.
  Candidate `46a8d3d32351847b9ad93df91ee8617776e6a6fa`: **16/16passed**,
  exit0/stable. The original11 contact cases remain intact; five added cases
  cover interruption, unknown-ID loss and normal up/loss ordering.
- Native baseline: the original published101b production build, port4404, using
  candidate46a8d3d3's regression test. **4/4failed**, exit1/stable,113.01s.
  Every case reached the trusted capture-loss/outside-release protocol and full
  unchanged-state checks, then failed both hover-camera stability and the first
  click destination. No setup failures; original dist byte hashes stayed equal
  throughout. Canvas/WebGL query profiles, landscape1368x912 and portrait834x1194,
  touch-capable Chromium at DPR1. The first click stayed3,7 instead of1,7.
- Candidate source/test producer `46a8d3d32351847b9ad93df91ee8617776e6a6fa`,
  complete tree `d15de3425b6b7fc093f4148e4d3576a89cd6311b`:
  **12/12 native cases passed**, exit0/stable,251.69s. New capture4 plus existing
  pen8 (exploration and combat) ran in one serialized installed-Chromium worker,
  zero skipped/flaky/retried cases. Separate portrait rendered probes observed
  actual Canvas and WebGL backends, unchanged hover camera and first-click
  movement3,7→1,7, with no page errors. Root inspected both resulting stills;
  this does not grant final style or physical-input acceptance.
- New native cases use real Playwright mouse input and the actual capture API.
  They record and assert trusted browser lifecycle events, compare full state,
  check hover stability and derive the ordinary road target through actual
  previewWalk and painted projection with an elementFromPoint visibility guard.
  One normal click must reach1,7 and preserve down/got/up/lost ordering; no
  recovery click or fabricated state. Existing pen exploration/combat positive
  and negative assertions run alongside them.
- Runtime/unit and E2E were cross-reviewed by their other worker, then combined
  source was inspected by root. No actionable source findings. Workers ran only
  scoped formatter/typecheck/lint; all tests/build/browser checks were serialized
  by root. Original60s case/10s expectation limits and zero retries are preserved.

Raw receipts, reports, traces, build hashes, trusted event probes and screenshots
remain under `/workspace/avatarrpg-env/capture-discovery/`. Preserve baseline and
candidate evidence separately. Final clean-head ci:local and publication results
belong to the PR and receipt, never inferred from focused tests. A handoff-only
final commit must preserve src/public/e2e exactly relative to the native producer.

Physical mouse/stylus/touch, spontaneous capture interruption, Surface/iPad,
WebKit/Safari, PWA and final visual/performance acceptance remain open. No merge,
deployment, workflow dispatch, install, purchase, permission/credential/security
or art change. DeepSeek runner/shared accounting remain unverified; no requests.
Publish a verified descendant of101b to the SAME branch using expected-head
fast-forward, then verify remote head/tree and actual jobs including skips.
Never force-push the older divergent local ea43 graph. Draft status does not
mean the issue's unrun acceptance gates are solved.
