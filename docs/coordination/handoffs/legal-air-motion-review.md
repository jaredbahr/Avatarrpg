# Legal Air Blast motion review

Root, 19 September 2026. Product source `f0d01dd` in isolated
`codex/air-displacement-review`. This is a bounded representative motion review,
not a campaign completion, roster-wide signoff or audio/device assessment.

## Reproduction and provenance

`npx playwright test -c playwright.air-review.config.ts` runs four opt-in cases
in installed Chrome: Canvas/WebGL, normal/reduced motion. It records continuous
1440x1080 video with blocked service workers and a measured 96px camera.
The dedicated config is separate from required CI and owns preview port 4319.
The completed capture run passed 4/4 in 31.7 seconds and stopped its server.

The harness starts solo Nima, seed `air-displacement`, directly at the authored
Forest Road battle. This stages the encounter, not the campaign route. It uses
legal movement and end-turn commands, then finds an Air Blast whose real reducer
result includes displacement. The same command is dispatched through the app.
No unit positions, stats, RNG, animation events or outcomes are overwritten.

In round 2, the slinger moves from `(13,5)` to `(15,7)` after Air Blast. The
recorded events are `abilityUsed`, an 8-damage air critical hit, and `unitPushed`.
Normal and reduced runs agree on the target and destination in both backends.
The camera includes caster and landing; earlier smaller viewport experiments
clipped the caster or landing and are superseded by the final recordings.

Evidence is retained in the isolated worktree:

- `.shots/air-displacement/f0d01dd/{canvas,webgl}-{false,true}/`: before/after
  screenshots and full command/state/event/camera metadata. Boolean is reduced
  motion. All four report the requested backend and exactly 96px tiles.
- `.shots/air-displacement/results/`: continuous videos and Playwright results.
- `.shots/air-displacement/frames5s/`: final decoded frame review artifacts, 50
  frames per normal video at 0.1s spacing. Canvas spans 6.360–11.260s; WebGL
  7.760–12.660s. Seek error is below 0.001s. Root reviewed both first-half
  contact sheets and an independent full-size Canvas frame at 8.4s extracted
  with the bundled Playwright ffmpeg. Initial zero-time extraction attempts
  and the later idle-only final-two-second sheets are insufficient evidence.

## Scope

Root inspected the final before/after composition and decoded normal-motion
sequences on both backends. The caster winds up and releases, shaped air travels
to the slinger, contact appears, and the target slides to its landing before
settling. Both actors and the full landing remain visible. Reduced motion was
functionally checked separately; detailed reduced-motion frame review is not
claimed. The recordings do not include audio.

The baseline exposed a confirmed defect: the target's health bar updates to its final
damaged value during wind-up/flight, before contact. Canvas 8.4s clearly shows
the air projectile midway to the already-yellow target bar. Both normal
sequences exhibit this. `CombatScene` supplies immediate reducer `u.hp` to the
render view, so choreography does not yet time world-health feedback. Root
assigned the bounded presentation fix to Terra in `codex/impact-health-timing`,
starting from `5b94101`.

## Correction and after review

Terra's `d5a840f` is integrated as `61991a9`; test follow-up `88243b6` is
integrated as `752dd49`. World-unit HP and fallen presentation now follow
existing choreography damage/heal/KO timestamps. Reducer health, AI, saves,
events, FX timing and HUD remain unchanged. Queued intermediate health is
retained only while future cues remain; pruning then restores rule-state
authority. Tests cover normal/reduced impact, queued damage/heal, lethal KO,
reset and fallback, and compare health timing to the existing hit-flash track.

Root built product `61991a9` (`index-Bu-fwWde.js`, 292.30 kB gzip) and repeated
the four legal capture cases at source `752dd49` (test-only difference): 4/4
passed in 32.3 seconds. The root follow-up worktree retains before/after and
event metadata in `.shots/air-displacement/752dd49`, videos in the adjacent
`results` directory, and independently decoded full-size PNGs. Canvas at 8.4s
shows full green target HP during flight; 8.8s shows damage and the pushed
landing. WebGL at 9.1s shows green during flight, and 9.3s shows yellow at
contact. Root inspected these frames and the final landing. This closes the
observed early world-health feedback defect; no broad roster/audio/device
acceptance is inferred. Preview 4319 terminated with the test run.

Existing elemental sampled evidence remains separately documented in
`elemental-motion-review.md`; this review adds real-time legal push playback
rather than replacing or broadening that earlier evidence.
