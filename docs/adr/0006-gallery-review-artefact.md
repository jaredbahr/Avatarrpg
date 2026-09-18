# ADR 0006: The gallery as the review artefact

**Status:** accepted, 2026-09-16

## Context

The look is the open question. Every visual decision so far (ADR 0003, ADR
0004, the art bible) is written down and none of it has been seen, and the
owner reviews from a tablet, not from a dev server. A change to the ground
shader or the choreography has no way to reach him except "pull the branch
and run it", which is not a review loop. Meanwhile the e2e suite already
drives the production build through every scene, and Playwright can hold the
page's clock still.

## Decision

`npm run gallery` captures a fixed catalogue of beats as PNG stills and
filmstrips, on every project the game targets, from the production build,
with a fixed seed, and publishes them where a tablet can open them.

- **Beats are data.** `e2e/gallery/beats.ts` lists each beat with the note a
  reviewer is meant to judge it by; `scripts/gallery-index.mjs` turns the
  captures into one page with those notes as captions. A new beat is one
  entry.
- **Staged through the game, not around it.** A beat drives the real UI
  (`e2e/helpers.ts`) and edits state the way the e2e specs already do
  (`e2e/gallery/stage.ts`), then calls `App.resync()`. Nothing in `src/core`
  or the renderer knows the gallery exists; the one hook added for it is
  `resync`, which re-runs the scene routing after state surgery.
- **Filmstrips use the fake clock.** Playwright's `page.clock` is installed
  before the first navigation, paused just ahead of the animator's `push`,
  and advanced with `runFor` between captures, so a still at 200 ms into a
  cast is the same still every run. Nothing frame-driven is awaited while the
  clock is paused: a filmstrip's act is a dispatch, never a click.
  Captures now fast-forward the unsaved interval and render its final frame
  interval with `runFor`. Poses and effects sample absolute elapsed time;
  rendering every intermediate frame on software WebGL added minutes without
  adding any saved images. Due timers still run. Ambient decoration may have
  fewer presentation ticks; it is not a frame-by-frame simulation reference.
- **No video.** CI runners rasterise WebGL in software at a few frames a
  second; a recording would show the runner, not the game. Stills at exact
  animator times show the game.
- **Where it lives (updated September 2026).** `gallery/` is gitignored. CI
  uploads it as an artifact for seven days. Normal Pages deployments omit it
  to avoid repeating the full capture. A manual deployment can opt into capture
  and publication at `dist/gallery/`; the next normal deployment removes that
  optional gallery. An optional Pages capture cannot block deployment
  (`continue-on-error`). See [the gallery guide](../gallery.md).
- **Capture versus visual acceptance.** Successful CI capture is a required
  check. Nothing asserts on pixels: the run asserts that every beat can still
  be staged, while a reviewer must inspect the images to accept the result.
- **Projects.** The Surface at 1x on both backends, the iPad at 2x on both
  backends, and the iPad upright for the two beats that care about a stacked
  HUD. Filmstrips are captured on the 1x projects only: a filmstrip renders a
  frame per sixteen milliseconds of fake clock, and a 2x WebGL frame on a
  software rasteriser takes over a second. Chromium only; stills do not need
  WebKit.

## Consequences

- Every visual slice ships with its gallery, and the review is the gallery:
  the pictures attached to the PR and the Pages URL.
- Portraits dropped in by the manifest appear in the gallery with no other
  change, which is the check that the intake in `docs/art/README.md` works.
- The beats fix the party (`kaya`, `bo`, `nilak`, `nima`, one player) and the
  seed `'gallery'`. Retuning an ability changes a floater's number, not the
  composition; changing a map's authored water moves the lightning beat, which
  reads the puddle by coordinate and says so. The cast beats step the dice to
  a hit first (`loadDice`), because the seed's first roll is a miss on every
  beat and a miss shows nothing; the walk is fixed, so the frames still are.
- The catalogue grows with the milestones: a grid-off beat with ADR 0007, a
  character-sheet grid with the asset contract, and with ADR 0009 a beat
  (`18-backdrop`) that puts the probe painting under the forest road through
  `App.overrideBackdrop`, so the painting slot is reviewed before any
  painting exists and a real one simply shows up in the board beats.
