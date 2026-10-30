# ADR 0099: Frame the party before the combat result

**Status:** accepted, 2026-10-29.

## Context

The result card appeared as soon as combat ended, dimming the board before the
player could read the party's outcome. The camera could also remain zoomed on
one actor while surviving party members were spread across the map. A short,
quiet transition gives the player a view of who remains before presenting the
existing result and Continue action.

## Decision

- On victory, finish the last hit and floaters before framing all living party
  members. Hold the undimmed battlefield for 1000 ms before showing the existing
  result card. Defeat remains immediate.
- Keep the party together using the camera's `centreOn` and `zoomAt` APIs. Start
  at the camera's closest public stop and zoom out only until the party bounds
  and a small cue margin fit; integer
  oblique zoom continues through the camera's existing scale stops.
- A tap on the clear-board overlay or its visible Show result button skips the
  hold immediately. Reduced motion keeps the current camera frame and shows
  the card once playback idles. Scene suspension
  and the pause menu pause the beat clock; the separate AI-dispatch hold does
  not. Unmount or a phase change cancels the pending beat.
- During the beat, terminal gameplay and focus controls are locked while the
  Pause control remains available. The scene result, story/dialogue flow,
  rewards and save data are unchanged.

## Consequences

- `CombatScene` owns the presentation lifecycle; `victoryBeat.ts` provides the
  pure bounds and clock helpers. App's pause lifecycle has a separate optional
  scene hook for timed presentation, independent of `holdAi`.
- Unit coverage protects spread-party framing, orthographic and integer camera
  scales, the playback boundary, result-overlay timing and skip, pause/resume,
  cancellation and reduced-motion behavior. The victory
  gallery captures the clear beat and unchanged result card and exercises
  Continue after resuming the scene.
