# ADR 0011: Sound

**Status:** accepted, 2026-09-16 (lands in Milestone 5, slice M5.4)

> Numbered 0011 rather than the 0012 the Milestone 5 plan named: the terrain
> textures that would have taken 0011 were rejected (see the Milestone 5
> record), so the number was never spent.

## Context

There is no audio anywhere in the repository. Phase D of the roadmap has
stood unchecked since the beginning, and every ability in the game — a
fireball crossing five tiles, a stone landing, a whip snapping back — plays
in silence.

Milestone 5 set out to fill empty slots with public-domain work, and the
search turned up a clean split. Kenney's CC0 packs, reachable here through a
GitHub mirror, cover the world and the interface **well**: 133 impact sounds
(punch, soft, wood, plank, glass, metal, mining), footsteps on grass, wood,
concrete and snow, and 103 interface sounds. They contain **nothing** that
sounds like bending. There is no fire whoosh, no stone grind, no water swirl,
no wind. The nearest free thing is a chiptune "zap" from Kenney's digital
audio pack, and a chiptune zap under a hand-painted lightning arc is worse
than silence — the same mistake as putting a photograph of a lawn under a
cel-shaded board.

So the content problem is only half solved by downloading, and the engine
problem is untouched. Three facts about browsers shape the rest:

- **iOS will not make a sound before a gesture.** A context created on load
  starts suspended and stays suspended.
- **A frame loop cannot schedule a sound.** Web Audio has its own clock, and
  starting a source at `currentTime + delay` is sample-accurate whatever the
  renderer is doing. Polling a timeline once a frame is strictly worse, and on
  CI's software rasteriser a frame can take over a second.
- **Cues arrive in clumps.** A blast over twenty-five tiles emits a cue a
  tile; under reduce motion an entire round collapses onto one instant.

## Decision

- **Two kinds of sound, and a key resolves to either.** `src/content/sounds.ts`
  holds a zod-validated table. A `sample` is a file under `public/audio/`; a
  `voice` is shaped noise — a noise colour, a filter sweep from one frequency
  to another, a resonance, an envelope, and optionally a crack at the head —
  rendered in the Web Audio graph. The world and the interface are samples;
  **every bending voice is described rather than recorded.** That costs no
  bytes, tunes by editing a number, and is the same fallback-then-swap
  contract the drawn marks (ADR 0006) and the painter figures (ADR 0003)
  already use: a recorded voice can replace one later by key and nothing else
  changes.
- **A key falls back to its element exactly as an fx key does.**
  `resolveSound('fx.fire.blast')` finds no row of its own and takes `fire`'s
  voice, through the same middle segment `resolveFx` reads. So an ability
  needs no row at all, a new element needs one, and a test asserts every
  ability in the game resolves to something. A key nothing covers is
  **silent**, never approximated: the wrong sound is worse than none.
- **Cues are not tracks.** `choreograph` already knows when everything
  happens, so it emits `SoundCue { key, at, seed }` beside the tracks rather
  than a second traversal that could drift from the first. They are scheduled
  the moment a push is known, on Web Audio's clock, and never polled. Nothing
  is added to the timeline, so `busy()`, `finishesAt` and `waitForIdle` mean
  exactly what they meant (ADR 0004).
- **The animator takes a sink, not a bus.** `AnimatorOptions.onSounds` is
  optional and the animator never reads it back; with no sink the game is
  silent and otherwise identical, which is how every unit test runs.
- **Cues of one key that land together are one sound.** The bus drops a repeat
  within 45 ms. That is what keeps a twenty-five tile blast, and a round
  collapsed by reduce motion, from machine-gunning.
- **Reduce motion keeps its sound.** The setting is about motion; a silent
  fight is not an accessibility win. Particles still stand down, as they did.
- **Unlocked by every gesture, not the first.** `pointerdown` and `keydown`
  both call `unlock()`, which is a no-op once the context runs. iOS suspends
  the context again whenever the page goes to the background, so "unlocked
  once" is not a state worth trusting. `pointerdown` rather than `click`,
  because a tap that becomes a drag on the board never becomes a click.
- **Off means off.** `Settings.volume` is 0 to 1, shown as four buttons
  (Off / Quiet / Normal / Loud) through the existing `choiceRow`, so it
  inherits the tap size, the Largest-text scaling and the `touch.spec`
  coverage instead of needing a range input with none of it. Zero **closes the
  context** rather than running a silent graph.
- **The interface asks for a click without knowing what makes one.**
  `button()` in `ui/dom.ts` takes a label and a callback and nothing else, so
  the bus is registered in `src/app/audio/ui.ts` rather than threaded through
  every caller. A `btn-primary` commits and gets the heavier sound; everything
  else taps. Those two cues are the only interface rows, because a row with no
  caller is a file shipped for nothing.
- **Sound is budgeted as its own family**, 4 MB like any other, checked by
  `check:assets`. It sits at `public/audio/` and not under `public/art/`,
  because the art scripts, `art:validate` and the prompt packs all walk that
  folder and none of them has anything to say about an ogg. The effects
  precache (the whole set is under a tenth of a megabyte); **music, when there
  is any, must be excluded from `globPatterns`** or a first load on a tablet
  stops being a breath.
- **Presentation randomness stays seeded.** The noise buffers and the choice
  between a cue's variants go through `mulberry32`, never `Math.random`
  (CLAUDE.md, non-negotiable 2).

## Consequences

- Twelve CC0 files, 91 KB, and 3.1 KB gzipped of JavaScript buy the whole
  system: bending, footsteps, impacts, splintering props, going down, and a
  click on every control. The bundle goes from 293.0 KB to 296.1 KB of the
  300 KB budget, and the audio family is 0.09 MB of its 4 MB.
- `src/core/` is untouched. No event changed, no state field, no save schema.
- **The voices are tuned blind.** They were written from how the elements are
  described, not from listening — the container has no way to hear them. The
  numbers in `SOUND_FAMILIES` are a first guess meant to be edited by ear, and
  the go/no-go on whether bending _sounds_ like bending is the owner's, on
  the device, exactly as the look gate was.
- A recorded bending pack, generated or bought, drops in by turning a voice
  row into a sample row. Nothing else moves.
- Music is not built here. It needs the lazy-load and precache exclusion above
  and a second volume control, and it should wait until the effects are judged.

## Alternatives rejected

- **A chiptune pack for the bending.** Free, reachable, and the wrong genre by
  a mile. Rejected for the same reason as the photographic ground textures.
- **Polling a sound track off the timeline each frame.** Needs the track to
  survive `prune`, misses cues when a frame is slow, and ties audio timing to
  render timing for no gain. Web Audio schedules better than we can.
- **A range input for the volume.** New control, new CSS, new tap-target
  coverage, for a preference with four useful positions.
- **Threading the bus through `button()`.** Would touch every call site in the
  game to deliver one click.
