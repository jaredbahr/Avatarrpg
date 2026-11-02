# Nested Pause keyboard evidence — #384

Actual local production game, Chromium154, 1368×912 touch profile/DPR1, Canvas.
No art, renderer, App/scene or AI behavior changes are part of the correction.

- **Baseline:** main0d4 source/public, served from harness-only781c9278 build.
  Settings→Escape removes both child and Paused. See baseline-repro.json and
  baseline-after-escape.png. The unchanged original inspector passes, both new
  nested regressions fail: **1 pass/2 fail, exit1**, 36.49s. Failures retained.
- **Candidate:** clean `6e043545372e277bd1c7db879da2daca05ce648d`, full tree
  `44ec5aa3f910382c94cd8db56bcf624847b97e20`: **3/3 pass, exit0**, 38.37s,
  stable before/after source/tree/harness, zero Playwright retries. Existing
  inspector case unchanged. New Settings/Save cases verify child Tab wrapping,
  one-layer Escape, opener focus, final Pause dismissal and original focus.
- **Additional production UI probe:** both child Escapes leave Paused set and
  the right opener focused. The actual combat scene's releaseAi observer
  forwards the original function:0 calls while child Escape leaves Pause open,
  exactly1 on final Pause Escape. Page errors[]. No state/clock/AI-delay changes.
- **Preserved probe failure:** first probe used nonexistent road_ambush and
  reported "Combat scene missing"; no combat pass from that attempt. Corrected
  probe uses the existing battle_ambush node and ordinary Ready control.

provenance.json records exact producer/file hashes. The later evidence/handoff
commit does not change src/public/e2e. Root inspected the native retained parent
sheets; native keyboard assertions establish behavior rather than stills alone.
Full logs/traces/videos remain in the local nested-pause runs/artifacts folders.
Required full ci:local must pass on exact final head before push; its final result
belongs in the PR. No full-suite pass is inferred from the focused native run.

This is local Chromium input/rendered UI coverage. WebKit, physical iPad/Surface
and PWA/physical-input acceptance remain open. No 60fps/art/style acceptance,
hosted browser/gallery run, merge, deployment or live user-tab inspection claim.
