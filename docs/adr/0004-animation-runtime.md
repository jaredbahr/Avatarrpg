# ADR 0004: Animation runtime

**Status:** accepted, 2026-09-15 (lands in Phase A3)

## Context

`src/app/animator.ts` turns reducer events into timed tracks sampled per
frame. Its contract — `push`, `busy`, `finishesAt`, `prune`, `clear` and the
per-frame samplers — is what the e2e `waitForIdle` helper and the AI turn
pacing depend on. Motion today is linear position lerps and sine pulses; there
is no easing, no sprite frame state, no camera choreography and no particles.

## Decision

Evolve the animator; do not replace it.

- New `src/app/anim/`: `easing.ts`, `timeline.ts` (typed tracks with easing), `choreography.ts` (event → tracks: approach, wind-up, cast, projectile, impact, recoil, floater, KO), and camera tracks (focus, shake) that the scene applies to `Camera` each frame.
- `RenderUnit` gains `clip`, `clipTime`, `offset`, `scale`, `flash`. `MapView` gains `emitters` (definition, position, progress, seed). The renderer stays a pure function of the view and time.
- Particle recipes are content (`src/content/fx.ts`), keyed `fx.<element>.<name>` and validated by zod. A new ability or element needs no `src/core/` change.
- Particle randomness is seeded per instance from the event index. The game RNG is never touched; determinism is unaffected.
- Reduce-motion keeps the existing `rate` collapse; particles reduce to a single flash.
- Canvas 2D draws the clip frames and the flash; particles are WebGL-only (ADR 0002).
- No tween library. The runtime is roughly 600 lines, the JavaScript budget is tight, and test timing must stay deterministic.

## Consequences

- `busy()` and `finishesAt` keep their meaning, so the e2e suite and the AI pacing do not change.
- Every event kind the animator handles today must play through the new runtime before A3 closes.
- Frame budget: 60 fps on an A12-class iPad with the boss map and a 5×5 blast on screen, measured with `?stats=1`.

## Amendment, 2026-09-16: as built

The runtime landed with the look-gate milestone. What it decided along the
way, where it departs from the plan above, and why:

- **Choreography before sheets.** The roadmap put the asset contract (A2)
  before the animation runtime (A3). The gate is about the look, and the
  choreography needs no sheets: `RenderUnit.clip` and `clipTime` travel in
  the view from the first day and the painters ignore them until the sheet
  runtime reads them. So A3 shipped first.
- **Stateless particles.** Nothing is simulated frame to frame. Every
  particle's birth, life, velocity and spin come from a generator seeded per
  emitter instance from `(push, event, slot, index)`, and its position at any
  age is closed-form (`src/render/fx/simulate.ts`). Both backends therefore
  draw the identical frame from the same seed, a filmstrip can ask for the
  picture at 200 ms directly, and a dropped frame costs nothing. The game
  RNG is never touched.
- **Recipes are content, colours are roles.** `src/content/fx.ts` holds a
  zod-validated recipe per fx key or per element family: what plays at the
  caster, what travels, what lands, what every affected tile gets, plus the
  hit-stop, the shake and the flash. Colours are roles (`base`, `light`,
  `accent`...) resolved through the palette at draw time, so the palette
  stays in the three places it already lives. Budgets are tested: at most
  400 particles a recipe, 24 per area tile.
- **One atlas, shaped particles.** Nine white cells with the art bible's ink
  edge (a glow, a disc, a ring, a spark, a shard, a leaf, a puff, a droplet,
  a stone), painted once by Canvas 2D and tinted. Bending that reads as a
  shape rather than a cloud is drawn as strokes from the same sampler: a
  jagged bolt, a wavy lick of flame, a whip that reaches and snaps back,
  cracks across the ground, slabs rising out of it, arcs of air, a strike
  down out of the sky for a storm.
- **Born at `from`, aimed at `to`.** Every emitter, particles and strokes
  alike, starts at the point it is emitted from and uses the second point
  only for direction: a cast's `from` is the caster and its `to` the target;
  an impact's `from` is the target and its `to` a tile beyond it along the
  cast. The first gallery frames caught a rock throw's cracks drawn a tile
  past the bandit because the point strokes had it the other way round.
- **Whips and bolts travel.** Anything drawn from the hand to the target (the
  water whip, the lightning bolt, the metal cable) is a travel emitter, not an
  impact one. The choreography stretches a travel particle emitter to the
  real flight and gives a travel stroke twice it, out and back, so a whip
  reaches the target as the hit lands. A projectile head lives exactly the
  flight and points along it; `spin` still turns a stone.
- **A hit has a core.** Every impact opens with a still bloom (`glowBurst`)
  under the burst, and every cast gathers the element at the hands through
  the wind-up, so an effect has a beginning and a centre rather than
  scattering from nothing. Thrown rock and its debris are stone-grey (the
  fixed `stone` role, alongside `white` and `smoke`) whatever the element's
  palette; cracks are ink.
- **WebGL draws through `ParticleContainer`**, one per blend mode per layer,
  all from that atlas, so a layer is a handful of draw calls; strokes go
  through `Graphics` with a `#1b1410` under-stroke for the ink. Effects sit
  on two layers: ground-level ones under the units, the rest over them.
- **Canvas 2D is not flash-only.** The plan above left it a flash; it now
  draws the same sampled particles and strokes through `drawImage` from
  tinted cells and plain paths, capped at 96 particles and 60 stroke segments
  a frame. The CI gallery runs on Canvas 2D projects too, and the fallback
  should show the effect the rules are describing. ADR 0002's parity note:
  `capabilities.particles` is true on both, with the cap documented here.
- **Hit-stop is a hold, not a time warp.** The choreography pins the flash to
  the impact and starts the recoil, the number and the next event after the
  hold. Everything already in flight keeps moving, which reads as a held
  frame at this scale and keeps `finishesAt` honest.
- **The camera shake is a nudge in the view.** `MapView.cameraNudge` is in
  tiles; each backend moves its world by it. `Camera` and `rendererCamera()`
  are untouched, so the e2e helpers keep mapping tiles to pixels.
- **The e2e suite runs under reduce motion.** `startGame` turns it on unless
  a spec opts out: the suite tests rules and UI, and a full cast plays for
  most of a second per enemy per round. `e2e/animation.spec.ts` opts out and
  checks that a cast plays and settles on both backends without a console
  error, and that reduce motion collapses it to an instant.
- **`busy()` and `finishesAt` mean what they did.** Durations are the
  constants in `src/app/anim/choreography.ts`; the walk step is unchanged.
