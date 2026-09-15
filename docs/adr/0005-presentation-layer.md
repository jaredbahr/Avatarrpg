# ADR 0005: Presentation layer

**Status:** accepted, 2026-09-15 (lands in Phase P1)

## Context

The UI applied a sound palette as a generic dark dashboard: the system sans
everywhere, flat panels with a one-pixel line, menus on an empty black, a
dialogue scene that was one small bust in a box, scene changes as hard swaps.
The art phases (A2 → B → C) replace the placeholder units and portraits and
leave all of that untouched, and A2 alone changes nothing on screen. The
presentation layer is the part of the look that does not depend on generated
art, and it is where every later asset lands.

## Decision

### One display face, self-hosted

- Shippori Mincho 700, the Latin slice Google Fonts serves (28,720 bytes),
  committed under `public/fonts/` with its OFL text and a README recording the
  source URL, unicode range, fetch date and sha256. There is no subsetting tool
  in the pipeline; the served slice is the artefact. Zen Antique was the
  runner-up and lost on having no true bold. Cormorant reads European and
  Cinzel reads Roman.
- `font-display: swap`, preloaded from `index.html` with `crossorigin`. Applied
  through `--font-display` to `h1`, `h2` and `.display`; `h3` and body text stay
  on the system stack. `font-synthesis: none`, so a missing weight is never
  faux-bolded.
- It joins the service-worker precache through the existing `woff2` glob. The
  JavaScript budget is unchanged; the file counts against the 25 MB precache
  budget that arrives with A2.

### Tokens: no colour literal outside `:root`

- `src/styles/base.css` holds every colour, type size (`--fs-*`), z-index
  (`--z-*`), duration and easing (`--dur-*`, `--ease-*`), surface and shadow.
  Nothing outside that block writes a literal; the art bible is checked against
  one list.
- Alpha tints of a palette colour use `color-mix(in srgb, …, transparent)`
  rather than a parallel set of rgb triplets, so the palette stays at three
  copies (`base.css`, `render/palettes.ts`, `backends/shaders.ts`) instead of
  gaining a fourth. Floor: iPadOS 16.2 and Chrome 111. Scrims and shadows are
  plain black-alpha literals because they are not palette colours.
- Decorative edges are `--hairline: 1px` on purpose: an outline must not
  thicken with the Large-text setting. Everything sized stays rem.
- `.element-<id>` sets `--el` and `--el-soft`; components draw with those, so
  a new element is one block, not a rule per component.

### Backdrop and mood

- A `.backdrop` under the scene host: grain, a radial base, two washes in the
  mood colour and the four-nations wheel as a line drawing. `data-scene` and
  `data-mood` on the app root select the look. The mood is the map's
  `ambience` by default, the element being picked during setup, or the
  speaker's element in dialogue, read from the palette the asset manifest
  already tags every portrait with. An ambience the CSS does not know falls
  through to gold, so content adds one freely.
- Cost rules, because it is under everything on an iPad: no `filter`,
  `backdrop-filter` or `mix-blend-mode`; no per-frame JavaScript; the washes
  drift on the title only; washes and wheel are hidden under the map scenes.
  Reduce motion stops the drift; high contrast removes the wash and the grain.

### Scene motion: a curtain, not a cross-fade

- `App.showScene` stays synchronous. The level-up flow opens a dialog in the
  same dispatch, the e2e helpers read `state.screen` right after a tap, and
  the map camera is measured from the canvas the moment it mounts; a swap at
  the midpoint of a fade would break all three. A curtain in the overlay host
  drops opaque _after_ the swap and lifts over `--dur-slow`. It takes no
  pointer events, sits above dialogs and below toasts, and a timer lifts it if
  `transitionend` never comes.
- Dialogs ease in through CSS only. There is deliberately no exit animation: a
  closed dialog that lingers in the DOM is a node the e2e suite and assistive
  technology can still find.
- Every duration is `calc(var(--dur-x) * var(--motion-scale))`, so the
  Reduce-motion setting collapses all of it; `motionReduced()` guards the
  JavaScript side.

### Out of scope

- The map's margins keep the backends' opaque clear colour. A wash there needs
  a transparent clear on both backends, which is a rendering-contract change
  for Phase P3 and its own ADR.

## Consequences

- Adding a colour, size or duration is an edit in one block; a literal
  anywhere else is a review comment.
- The art bible's font section is decided; Phase B no longer carries "one
  display font".
- A recolour still touches `base.css`, `palettes.ts`, `shaders.ts` and
  `scripts/make-icons.mjs`; a generator that writes them from one source is a
  follow-up, not part of this phase.
