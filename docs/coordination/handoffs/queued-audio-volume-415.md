# Queued sound volume (#415)

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
