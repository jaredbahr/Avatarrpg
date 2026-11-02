# Nested Pause keyboard dismissal — #384

Owner: root, new Improve Avatar RPG goal; bounded SOL High source worker.
Branch `codex/nested-pause-escape`, base main
`0d4c2b938f56bd5f8853323b0ea85d13b9a61ff2`.
[Verified claim](https://github.com/jaredbahr/Avatarrpg/issues/384#issuecomment-6566595614).
Scope is Dialog.ts, dialog-focus.spec.ts and this issue's handoff/evidence.
No open PR owns those files. Other shared App/scene/AI/style/save files untouched.

## Problem and correction

Pause intentionally remains open beneath Settings/Save. Every Dialog registered
an unconditional document Escape listener, so one Escape closed both sheets and
released Pause's combat hold. Root reproduced the production baseline:
`[Paused,Settings]` before, `[]` after one Escape, expected `[Paused]`, errors[].
Source/public equal main (harness-only baseline781c9278).

Only the top attached aria-modal panel now handles Dialog keyboard events,
before either dismissal or focus trapping. An underlying parent returns without
closing, including beneath a mandatory nondismissable sheet. No modal registry,
architecture change or gameplay timing/rules change. Existing Close/backdrop
behavior and focus restoration remain with Dialog.

New native browser regressions open Pause/Settings and Pause/Save by keyboard,
verify child Tab/Shift+Tab wrapping, one Escape returns to Pause and its opening
control, then second Escape restores the original Pause button. The existing
long-inspector case is unchanged. Native baseline: original inspector passes, both new regressions fail (exit1,
36.49s); source candidate clean6e043545: all3 pass (exit0,38.37s), stable
source/tree/harness. No retries or assertion/budget changes. Full required checks
must pass on the exact final head before push; record the actual final result
in the PR rather than inferring it from these focused checks.

DeepSeek executor/shared accounting unavailable: no requests. No installs,
merges, deployments, security changes or other ownership transfers. PR remains
draft until issue-specific and required latest-head gates are actually satisfied;
physical iPad/Surface/Safari/PWA checks cannot be inferred from headless Chromium.

## Native evidence and review

[Evidence](../evidence/384/README.md) retains baseline/candidate screenshots,
producer/file hashes and actual results. Root inspected the candidate Paused
sheets: one Escape leaves the correct opening control focused. In the actual
combat scene, an observer forwarding the original releaseAi records zero calls
after child Escape while Pause stays set, then exactly one on final Pause close.
No gameplay state, clock or AI delay is overwritten. Page errors[]. Independent
SOL source review found no actionable defects.

The additional UI probe's first attempt used a nonexistent story node and failed
"Combat scene missing" after its exploration checks. It establishes no combat
pass. The corrected probe uses existing battle_ambush and the ordinary Ready
control, preserving the failed record. No product change was needed.

Physical keyboard/touch on iPad/Surface, WebKit and PWA remain unverified.
Automatic hosted PR verification and actual browser/gallery skips must be
reported after publication; a skipped matrix is no coverage. No merge or
deployment. Discovery's next independent lead is the final-release-radius
omission in gestures.ts; its pure API reproduction emits a tap40px from start
with a10px threshold when prior move samples stayed near start. Verify duplicate
issues/claims and scope a separate correction before edits. #383 remains blocked
locally on PR356's explicit shared-test handoff; no repeated failed full suite.
