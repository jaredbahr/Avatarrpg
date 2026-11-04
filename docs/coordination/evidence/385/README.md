# Pointer release radius — #385

Native local production game, Chromium154/touch profile,1368×912/DPR1. The new
case forces Canvas and passes synthetic touch PointerEvents through the actual
canvas adapter; its positive control uses real mouse input. Other existing
camera/gesture cases are unchanged and use the game's ordinary backend choice.
No physical-touch incidence or acceptance is inferred from synthetic events.

- Baseline API: down(10,10), last move(15,10), release(50,10) emitted a tap40px
  from start despite a10px radius. New behavior tests on unchanged main record
  **3 fail/13 pass**. Corrected suite: **16/16 pass**, including cleanup/next tap,
  inside and exact-axis/diagonal boundaries, existing drag/pinch/longpress cases.
- Baseline native game, main0d4 src/public served from harness-only781c9278:
  the new regression **fails**, expected party(3,7), actual unintended walk(7,7).
- Candidate clean `6a0ff5b10296a5f571e6591cb03ca2451f4127fe`, complete tree
  `f0ffa6887c9804116dcc00e9c31404bcc4f12973`: entire gestures.spec.ts **10/10
  pass**, exit0/stable,75.75s, one worker/retries0. Nine previous cases unchanged.
- Additional native probe: distant releases with no final move and with only a
  near-start move both keep party(3,7); ordinary mouse tap then walks/settles at
  (7,7), errors[]. Position/camera assertions and the actual canvas input path
  establish behavior; stills alone do not. Root inspected retained stills.
- The initial worker pool option mismatch failed before product tests; retained
  separately. Correct min/max2 was used for both genuine red/green runs.

provenance.json binds final files to their producer. Later evidence/handoff
changes preserve src/public/e2e. The full required ci:local result belongs to the
PR and must pass on exact clean final head before push. No full-suite pass is
inferred from this focused/native evidence. Raw logs/traces remain in local
runs/artifacts; original failures remain failures.

Remaining: hosted exact-head jobs including actual browser/gallery skips,
WebKit, physical keyboard/mouse/touch/pen on iPad/Surface and PWA. No threshold,
assertion or deadline changed. No style/performance approval, merge/deploy,
new software, security or art change. Source patch only guards onTap's existing
radius; it does not synthesize a drag or alter ordinary movement/camera rules.
