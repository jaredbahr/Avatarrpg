# ADR 0056: Wind and a startled flock on the forest road

**Status:** Accepted  
**Date:** 2026-09-28

## Context

The forest road is the most-seen board and the emptiest-feeling one (visual
audit, "make it feel alive" items 1 and 2). It needs motion that sells a live
wood and the "they step out of the trees" beat, without touching the rules,
the saves or the determinism the balance simulator relies on.

## Decision

- **Scene data says what the wind moves.** `SceneImage.wind` marks ground
  that brightens as a gust crosses it and upright scenery that leans.
  `MapScene.flock` names a one-row strip of flap frames, their drawn size and
  how many birds fly. The forest road marks its fifteen pines and its two
  grass plates, and flies six birds (`docs/art/forest-birds.md`).
- **The view model gains two optional fields.** `MapView.reducedMotion` stills
  everything here, and `MapView.flushedAt` is when the flock burst out, on the
  same clock as `MapView.time`. `CombatScene` arms it once, 700 ms after a
  fresh fight (round 1, first turn) is first in front of its player, so a hot
  seat's hand-off card does not hide it and a save loaded mid-fight stays
  quiet (`src/app/scenes/flockFlush.ts`). "Fresh" is read from the battle, not
  remembered, so a fight saved and resumed before its first turn ends flushes
  again. That replay is accepted: the board is still at its opening beat. Both
  `CombatScene` and `ExploreScene` set `reducedMotion` from the Reduce motion
  setting.
- **All motion is one pure function of the render clock**
  (`src/render/living/wind.ts`): a gust crest travels screen-right, the pines
  shear about their feet by at most about four pixels, and the birds cross
  over the board away from their own trees. Nothing reads or writes the core
  RNG, `GameState` or the event log.
- **Parity follows the backend rule.** The lean and the birds are drawn on
  both backends. Canvas 2D holds three drawings of the lean instead of a
  smooth shear. The grass band is WebGL-only fidelity: three nested vertical
  stripes, each a slice of the grass plate that adds 5% of the grass back onto
  itself. Every stripe is a persistent sprite that owns a crop `Texture` on
  the plate's source and moves its `frame` in place (`Texture.update()`, which
  refreshes the UVs and tells the sprite). The slices move every frame, so
  asking the rect-keyed scene texture cache for them would build and destroy
  six to twelve textures a frame. A plate's stripes stay with that plate, so a
  stripe never swaps sources between frames, and a new crop is made only when
  the pool grows or the page reloads. Slices keep the 2048 px page limit that
  `sceneSourceRect` holds for every crop: a wind plate wider or taller than
  that gets no band. The stripes are not masked copies, and both mask
  kinds were tried and failed. A sprite mask composites offscreen and drops
  the add blend without any error. Graphics (stencil) masks broke the
  particle layers' batches with `renderPipeId of null` errors whenever an
  ability played with motion on. The needles are one more `drift` emitter in
  the forest's existing WebGL ambience.
- **The flock costs nothing outside its flight.** Each backend asks for the
  strip once per scene change, so it is decoded by the time a fight opens,
  and does no flock work before the flush or once the last bird has gone
  (`flushElapsed`, `(count - 1) × 150 + 3400` ms). The strip counts towards
  `SCENE_IMAGE_CAP` in `scene.test.ts`, so the image store cannot evict it
  between that one request and the flush. The content schema cannot see the
  file, so `npm run art:validate` checks that `frames × frameSize` fits the
  strip's width and `frameSize` its height.

## Consequences

The forest road moves as a living wood on both backends, and the WebGL grass
brightens under each gust. The bird strip adds 1.5 KB to the map family. The
branch as first reviewed measured 318.5 KB gzipped JS of 320. With the
persistent stripes it measures 318.7 KB: folding the held lean into `sway`
and sharing the flush gate did not fully pay for the stripe pool. The e2e
suite runs with Reduce motion on by default, so its frames stay still.
Another combat or explore scene opts in with data alone: mark its scenery and
ground `wind` and give it a `flock`.
