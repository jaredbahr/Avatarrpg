# Queued sound volume (#415)

## 2026-11-04: repair the returned browser gates

This continues the same draft PR416 and published branch. Claude's merged PR422
explicitly held PR413/416 out and handed them back: mobile WebKit rejected
`page.mouse.wheel`, and a source queued during a real walk could expire while
automation crossed a software-WebGL frame. Original run41733375995/job126261927147
and its unsupported-wheel error are retained outside Git. Claim6611777500 was
amended and read back before editing the fixture.

Main `2ba71a01` and the tested PR413 correction `ceda125a` were merged through
merge commit `ca54e1e0`, preserving published history. PR413's six-case native
evidence belongs to its own head; it does not transfer to a changed AudioBus.
This correction changes only the volume fixture and this human handoff, with no
new runtime behavior, shared helper, budget, asset or dependency changes.

The fixture dispatches the same pixel wheel delta to the actual canvas listener.
Before the real target click, it arms a one-shot native source observer. A real
current-context footstep scheduled over the original 0.5-second threshold queues
the existing asynchronous Settings measurement in a microtask. Native start,
gain calls and clocks are forwarded unchanged; no cue or deadline is fabricated,
delayed or held. Completion and callback errors are additionally asserted.

The original initial 0.5-second and retained 0.2-second thresholds, 45 ms sampling,
32/50 ms ramp checks, gain ratios, selected volumes, graph/context/state equality,
fresh footsteps and Off retirement remain intact, as do the 60/360-second caps.
Warm-up and fresh-walk controls are unchanged. This avoids spending the queued
source's lifetime on an automation/render round trip without relaxing the test.

Final exact-head `ci:local` and native results belong to the PR and external
receipts under `/workspace/avatarrpg-env/queued-volume-415/gate-correction20261104/`.
Keep this a draft under the current user instruction. No hosted dispatch,
WebKit installation, merge, deployment, formal approval, physical-input or
listening acceptance is claimed. Main's separate WebKit failures remain #423.

The sections below retain historical validation for the original revision.

Claim: issue comment 6611777500, session `queued-volume415-20261103`.
Branch: `codex/queued-audio-volume-415`, based on main
`207c8eecd0a31a9ed7835d5e1f9969b81f048794`.

Changing Sound from Normal to Quiet changed future submissions but left decoded
footsteps already scheduled by a walk at their original volume. The same issue
applied to queued synthesized voices, material layers and their crack transients.
The initial native witness retained two future step sources: their combined gain
stayed approximately 0.189 after Quiet, instead of 0.0945.

The private one-shot output gain now applies the setting after source envelopes
and before the existing fixed 0.6 master. The existing Settings `unlock()` call
refreshes it; cue submissions and same-context decode completions refresh it too.
Nonzero changes retarget a 32 ms linear transition without replacing sources or
the context. Repeated unchanged unlocks preserve a pending transition, and rapid
replacements hold the analytically calculated current level before retargeting.
Initial gain is set directly. Off retains the existing master release and context
retirement; old decode callbacks retain their context-identity guard.

Courtyard loops retain their existing direct-master path and their independent
volume smoothing. No App, Settings UI, environment, content, art or public API
changes are required. Voice peaks, body levels, filters and timing keep their
intended scale. The small nonzero exponential envelope floor now also scales with
the setting; rendered voice waveforms are not claimed to be byte-identical.

## Validation protocol

The new real-AudioBus unit graph/clock regression has ten cases. All ten pass
with the correction, together with six existing bus and seven existing
environment tests (23/23); scoped lint, formatting and typecheck also pass. Against unchanged
main it produced eight genuine queued-volume failures, with two Off/ownership
controls passing. The first harness run is separately retained; its unsupported
matcher and floating-point stop-time equality were corrected before runtime edits.

The new native regression runs actual Canvas and WebGL renderers. It uses API
new-game setup and debug village entry, then actual mouse walks on the rendered
board. It forwards native gain creation, connect/disconnect, sample starts and
parameter automation. After a long walk queues decoded footsteps, synchronous
DOM activation of the actual Pause → Settings controls captures Normal → Quiet
and Quiet → Loud on the same old sources. This avoids consuming a queued deadline
on browser automation round trips, particularly under software WebGL. Game and
audio clocks remain unmodified.

It checks the complete source-to-destination gain path, successful automation's
effective completion before each old source's deadline, unchanged source graph
and audio context, selected settings and full game state. A subsequent actual
mouse walk checks fresh footsteps; Off checks retirement and context closure.
Loud measures the nonempty still-future subset of the original retained sources:
software rendering may consume an earlier step during the first Settings
refresh. The initial all-sources capture is retained separately, along with an
environment-interrupted corrected baseline; only its unfinished WebGL case was
resumed. No assertions or runtime budgets were relaxed.

Raw graph reports and renderer images are attached even when the regression is
red. This is scheduling and rendered-control evidence, not proof of audibility,
physical input or Safari/PWA behavior.

Reports and review images remain outside Git under
`/workspace/avatarrpg-env/queued-volume-415/`; the original discovery is under
`/workspace/avatarrpg-env/volume-discovery/`. The PR records final results and
exact tested source identity. Preserve all failures and use the same branch for
corrections. Delivery remains a draft; no merge, readiness, deployment, dispatch,
installation, asset generation, paid request or security change is authorized.
