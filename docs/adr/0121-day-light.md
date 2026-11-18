# ADR 0121: The day's light on the board (dusk grade and lit lamps)

**Status:** Accepted (owner's look A, "warm dusk", 2026-11-18; issue #881)
**Date:** 2026-11-18

## Context

Ba Dan's brief asks for lamps coming on as the party walks home, and the homecoming night ends the
demo. The stage 8 review of #875 found it barely reads: each lantern got two warm pixels in its glass
at evening and night (ADR 0101's `lantern` stamp), and the board got no evening or night tint, so
midday and evening looked the same.

## Decision

A **light layer** joins the rendering contract. It is presentation only and lives in the view model:
`MapView.light` (`BoardLight` in `src/render/view.ts`), built in `src/app/dayLight.ts` from
`state.world.clock.phase` and the map's scene. The renderer never reads the clock or content;
`src/core/` is untouched.

### Data

`src/content/dayLight.ts` holds the table: a grade per day phase (`multiply` per channel, `lift` in
0-255), whether the lamps are lit, how much of the grade a fight takes, and the two glow styles (the
pool and the glass: radii in world px, up to three stepped rings, one amber colour). The values,
tuned by eye on Ba Dan:

| Phase                      | Multiply (R, G, B) | Lift (R, G, B) | Lamps |
| -------------------------- | ------------------ | -------------- | ----- |
| dawn                       | 1, 0.96, 0.96      | 5, 1, 4        | off   |
| morning, midday, afternoon | none               | none           | off   |
| evening                    | 0.92, 0.80, 0.78   | 10, 0, 14      | lit   |
| night                      | 0.76, 0.75, 0.86   | 4, 6, 22       | lit   |

A fight takes `COMBAT_LIGHT_STRENGTH` (0.5) of the grade: `multiply' = 1 - 0.5 (1 - multiply)`,
`lift' = 0.5 lift`. Its lamps are the scene's, at full strength.

### The grade

`colour * multiply + lift * alpha`, per channel, on the **world's art only**: the map's painting, the
scene's ground plates and every upright that sorts by depth (scenery, figures, NPCs, props, ground
flames). It never touches the procedural fallback terrain, the surface layer, the overlays, the
route, exits, rings, cast shadows, the reveal silhouettes, health bars, floating numbers, particles,
painted effect cels or the HUD; those draw as they always have, after or outside it. It is in the
canvas, never a CSS filter on the page, so the DOM stays untinted.

- **WebGL** runs it as one `Filter` (`GRADE_FRAGMENT`, GLSL ES 3.00, premultiplied input) on the
  backdrop sprite, `sceneGround` and `unitLayer`, at the device's resolution so the filtered layer is
  the same pixels. The filter is attached only while a grade is on. The reveal silhouettes moved out
  of `unitLayer` into their own layer just above it (they were already its top child), so the grade
  does not reach them.
- **Canvas 2D** draws each piece of world art from a graded copy of its page (`gradedSource`,
  `src/render/dayLight.ts`): the same size, so every source rectangle holds, made once per page and
  grade and forgotten with the page. Because the lift is weighted by alpha, a faded piece grades
  exactly as it does on WebGL.

Neither resamples: nearest sampling at integer zoom (ADR 0088, ADR 0104) is untouched.

### The lamps

`sceneLamps` reads the scene's `ambienceSources.lanterns` (the glass centres the board build measures,
ADR 0101) and finds the scenery piece each glass hangs in. The pool's centre is straight below the
glass on the line the piece stands on (its foot), and the piece's `depth` is the glass glow's sort
point. A glass no piece holds stays unlit. No scene field was added.

- **The pool** is stepped rings of warm amber (`LAMP_POOL`) on the world-pixel grid (ADR 0093: hard
  edges, at most three rings, no gradient), added (`lighter` / `add`) onto the graded ground, under
  every mark and figure. WebGL draws it in a `lampPools` layer between the scene's ground and the
  ground pass; Canvas 2D right after the ground and surfaces.
- **The glass** (`LAMP_GLASS`) is a small stepped glow inside the pane, added over its lamp at the
  lamp's depth: over the lamp, under anything in front of it. On WebGL it sits in the graded
  `unitLayer`, so the grade lands on its colour; Canvas 2D adds the colour already graded
  (`gradedRgb`) so the two match.
- ADR 0101's two flickering glass pixels stay on top as the flame.

Both draw only on the top-down board (the lamps are a scene's, in its 40 px tiles).

### Parity and motion

Both backends draw the grade and the lamps: exploration ambience is drawn on both (ADR 0008's
amendment), and this is part of how the board reads at night. The grade and the pools are static,
so reduce motion keeps them; only the existing glass flicker freezes, as ADR 0101 already does.

## Consequences

- A new day phase look is a row in `DAY_LIGHT`; a new lamp is a lantern source in a scene, found
  through its piece. No backend change is needed for either.
- Canvas 2D holds one graded copy per drawn page while a grade is on (about 30 MB on Ba Dan with a
  full party), and grades a page the first time it is drawn in a new phase.
- WebGL pays one full-screen filter pass per graded layer, only while the grade is on.
- The quarry and road maps have no lantern sources today; they take the grade alone until a scene
  gives them lamps.
