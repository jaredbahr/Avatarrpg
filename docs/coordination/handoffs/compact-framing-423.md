# Compact combat framing — issue #423

The normal-text 1194×834 combat frame must stay at 64 CSS px per tile, including
at DPR2. The 1368×912 roomy control can retain 96 CSS px at DPR2; integer zoom
continues to floor that preference to 64 at DPR1. These are existing regression
contracts in `e2e/gestures.spec.ts` and `e2e/combat-pan-reflow.spec.ts`.

## Reproduction and diagnosis

On main `432c0708` and the merged T1 foundation `3afb1405`, the unchanged framing
case fails in installed Chromium at DPR2 with both desktop and mobile context
modes: expected 64, actual 96. All original assertions, timeouts and inputs remain.
The source/build hashes are retained with each external report. This reproduces
one component of #423 outside WebKit; it is not WebKit or physical-device proof.

A same-frame observation on `432c0708` measured a 572.796875px canvas, rounded to
573 in the camera. The existing 200px allowance leaves 373, above the 360px
compact threshold, so the stored preference is 96. Both layout and visual
viewports are 1194×834. DPR1 floors 96 to 64 and hides this classification failure.
The compact landscape initiative strip is a source lead for the extra map space;
its accepted layout is preserved.

Do not describe this as an insufficient dock allowance or a newly proven hidden
target. The HUD's existing 40dvh cap bounds growth from the observed idle dock to
less than 200px. An additional external dock-observer attempt failed collection
before running any case; it supplies no gameplay evidence. The original
unmodified framing case was then collected normally against the same T1 build.

## Correction and ownership

Restore the historical compact viewport guard (height below 840 CSS px), using
the smaller layout/visual height, alongside the existing measured-canvas rule.
Shorter initiative UI therefore gives the map more room without promoting a short
tablet to the roomy frame. Keep the existing 40/64/96 preferences, frame key,
aim/confirmation preference locking, manual-camera guards and DPR rounding.
Only the oblique branch changes; top-down Recentre and the T1 projection stay as
merged. No CSS, art, rule, helper, test expectation or budget changes.

Root claimed this old-oblique scope in issue #423 comment 6621758035 before edits.
The earlier handoff request is #436/6676531278. T1 subsequently closed as completed
and PR437 merged; current open-PR file scopes show no other active owner of this
hunk. Root's existing PR357 has a separate camera feature hunk and must integrate
the eventual landing head with ordinary merge commits. Claude retains cover #435
and T2 art/manifest/packer #439. This correction changes neither.

## Validation and remaining scope

The integration owner records the exact committed head/tree, clean
`npm run ci:local` result and native results in the linked draft PR. Focused
validation retains the original framing and combat-pan-reflow cases, including
lower-target geometry, real movement/confirmation, manual pan, ability reflow,
resize, motion-enabled save load, Large/Huge text and both render backends.
Raw reports, traces, captures and hashes stay outside Git; no evidence media is
committed. No earlier producer's recording is relabelled as this revision.

This is a partial repair of #423. Its other historical WebKit ambush, water and
toast failures are not fixed or declared passed here. Current authorized WebKit
runtime evidence, Safari/PWA, physical-input/device and performance acceptance
remain separate. Preserve every original failure. No installation, dispatch,
asset generation, formal approval, readiness, merge or deployment is authorized
by this handoff.
