# Style test, 2D: report

The 2D side of the art-direction test: one courtyard cut from the shipped Ba Dan scene, Bo with idle, an
eight-way walk and his earthbending strike against a practice target. Layout: `layout.md` (the 3D team
builds the same one). Capture of play: `play-2d.webm`.

**Open it:** `npm run dev`, then `http://localhost:5173/dev/style-test-2d.html` (add `?renderer=canvas` or
`?renderer=webgl` to force a backend, `?stats=1` for a frame counter, `?debug=1` for cell coordinates).
Tap or click to walk; arrow keys or WASD step; Space or the "Earth strike" button throws (stand 2 to 5
cells from the post). The page is dev-only: it is served by `vite` and is not in the build (checked below).

## What it is made of

All of it is the game's own pipeline, none of it a parallel engine:

- Scene: `BA_DAN_VILLAGE` and its `BA_DAN_SCENE` (calm ground plates and uprights, ADR 0076/0083), drawn by
  the real `Renderer` on either backend, at the exploration camera and zoom.
- Bo: `unit.earth.bo` on his G sheets (`bo-g*`), idle and the eight-way walk through `Animator.locomotion`,
  stroll timing and the walk phase. His strike plays `rock_throw` through the real choreography
  (`choreograph` to `planBendCast` to `planBend`): his `bo-g-bend` clip, the painted earth effect, the
  bend's own hit-stops, the board kick, the dust emitters and the struck unit's recoil.
- Shadows: the village's runtime contact and cast shadow for Bo (`shadow: true`, the scene's
  `actorGrounding`), and for the target as an upright scenery piece.
- Ambience: `ambientEmitters(ambienceFx('village'), ...)`, the exploration scene's own call (motes, chimney
  smoke, canopy leaves, canal ripples).
- Target: a new 96x128 PixelLab map object, drawn as a scenery piece (the mechanism the village's own
  trees and props use), so it depth-sorts against Bo and the house. The recoil is the choreography's offset
  applied to the piece.

## Measurements (this machine, 1366x1024, headless Chromium)

Frame times are `requestAnimationFrame` deltas over the stated phase (`perf-2d-*.json` hold the raw
summaries). "Strike" is every frame while the animator was busy, two strikes per run.

| Machine path                           | Backend   | Idle                         | Walk     | Strike   | Worst frame in strike |
| -------------------------------------- | --------- | ---------------------------- | -------- | -------- | --------------------- |
| Real GPU (RTX 3080, D3D11 via ANGLE)   | Canvas 2D | 60.0 fps (16.7 ms, p95 18)   | 59.3 fps | 59.2 fps | 142 ms                |
| Real GPU                               | WebGL     | 60.0 fps (16.7 ms, p95 17.8) | 59.3 fps | 58.9 fps | 162 ms                |
| Headless default (SwiftShader, no GPU) | Canvas 2D | 53.1 fps (18.9 ms, p95 21)   | 51.7 fps | 48.5 fps | 80 ms                 |
| Headless default (SwiftShader)         | WebGL     | 6.2 fps                      | 6.3 fps  | 6.0 fps  | 261 ms                |

- On the GPU both backends sit on the 60 Hz refresh, so this run cannot show headroom; it shows neither
  backend drops frames in this scene. Mean frame time during a strike is 0.2 to 0.3 ms over idle.
- Software WebGL at 6 fps is the behaviour `CLAUDE.md` already records (a software rasteriser: the game
  picks Canvas 2D there). It is not a result about the scene.
- One hitch of 140 to 160 ms shows up on the GPU runs during the strike, on both backends. I did not isolate
  it; the likeliest cause is the first use of the bend and effect pages (decode and upload), but that is
  a guess.
- Asset bytes the page pulled (dev server, uncompressed, same on both backends): WebP 4.54 MB (ground
  plates and uprights about 3.5 MB, Bo's sheets and bend about 1.0 MB), PNG 1.50 MB (the effect cels and
  the 5.6 KB target), JSON 0.14 MB. About **6.2 MB of art** for the whole scene. The JavaScript figures in
  `perf.json` are Vite's unbundled dev modules and mean nothing for the shipped size.
- Shipping check: `npm run build`, then `dist/` has no `style-test`, no `dev/` and no target art (the
  target lives in `dev/assets/`, outside `public/`, so it cannot count toward the maps family budget, which
  sits at 7.34 of 7.5 MiB). `check-asset-budget` passes at 23.39 of 25 MB precache.

## Effort log

Wall clock, from first read to last measurement, was about an hour and a half. Times are my estimates
from file timestamps, not a stopwatch.

| Step                                                                                                                  | Time    | Generations |
| --------------------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| Read ADR 0055, the bend harness, `ExploreScene`, the animator and the choreography; find the village's grid and scene | ~25 min | 0           |
| Dev page and harness: renderer, camera, route finder, animator and strike wiring                                      | ~20 min | 0           |
| First run, choose the court on a labelled full-village screenshot, write `layout.md`                                  | ~15 min | 0           |
| Target: one try came back a man in a tunic (not a post), the second was a usable post                                 | ~5 min  | 2           |
| Place and size the target (the scenery piece used the wrong coordinate space and was invisible), measure its foot     | ~10 min | 0           |
| Capture script, both backends with and without a GPU (the default headless Chromium has none), video                  | ~20 min | 0           |
| Checks, build, the report                                                                                             | ~15 min | 0           |

Generations: **2 of the 25 allowed** (balance 5743 before, 5741 after). A cold Vite start took 92 s.

What did not go to plan, said plainly:

- The brief suggested a guide background and inpainting to put the post on the 2:1 lines. The tool takes the
  background only as inline base64, and a crop of the painting is far too large to pass that way from here.
  I used the plain map-object mode and asked for a front-right three-quarter view. I did not measure the
  post's angle, and I did not make a cracked or knocked state: the recoil is a position offset only.
- Arrow keys and WASD are wired but I did not exercise them. Tap-to-walk, Space and the strike were driven
  in the capture (three strikes, two from the west spot and one from the east).
- I looked at stills and contact sheets from the run, not at the whole video.

### Estimate: another character with idle, walk and one move

This follows the G recipe in ADR 0050/0051/0055: 192 px root-locked cels scaled 0.75 into 128x192 frames
at anchor (0.5, 0.85), 4 idle and 12 walk cels in each of 8 headings (128 cels a character), the placement
table and `pins.json`, `gates.json` and `checks.json` per walk, then a bend of about 12 to 16 cels in each of
8 headings plus its effect data. The ADRs do not record generation counts, so the numbers below are my
estimate from PixelLab's own cost lines, not a measured figure.

- Steps: design and rotate the character (v3, 8 headings), animate idle and walk in all 8, pin and place
  with `g-sprites.ts`, review against the party and run the gates; make the bend in 8 headings, pack it,
  write the bend and effect data and its tests.
- Generations: roughly 60 to 80 for one pass (walk, idle and bend, 8 headings each), perhaps 100 with
  re-rolls.
- Hours: 6 to 12, most of it review and re-rolling rather than generating.
- Size: about 0.2 MiB for the bend plus the walk and idle atlas (ADR 0051 measures 2,269 B a cel in WebP);
  ADR 0055 says about seven more benders fit the units ceiling.

### Estimate: another move for Bo

- A new move that reuses his existing bend clip with a different effect is data only (`bends.ts` and the
  painted effect cels): under an hour, no character generations. ADR 0055 makes a bend belong to the
  unit, not the ability, so every bending attack Bo has plays the one clip.
- A genuinely new clip (a second pose set in 8 headings, about 12 to 16 cels each) is roughly 20 to 30
  generations and 3 to 5 hours, plus an hour or two for its effect cels.

### What keeps the style from drifting

For characters: the G recipe itself (fixed cel size, scale, anchor and the planted-sole rule), the pin and
placement files, the measured gates, the party-consistency review, and the units budget and bundle gates in CI.
For the world: the painting is one continuous generated scene with frozen geometry, so a new house is a
repaint of a region, not a new sprite. **Props like the target have no equivalent gate**: the map-object
tool gave me a plausible post, but nothing ties it to the painting's palette, edge treatment or light.

## Honest notes

What looks good:

- The place. It is the shipped painting, and it reads as a real village in a way a hand-built scene would
  not: warm light from the upper left, worn stone, tile roofs, a canal with ripples. Depth sorting is the
  engine's own; I did not walk Bo behind the post to check that edge case.
- The court reads at both tablet sizes. At 1366x1024 and 1024x768 Bo, the post and the strike each stay
  legible; the post's pale straw pad is the strongest value contrast in its corner of the path.
- The strike has a real shape: the throw pose, a rock that leaves the hand, a landing with dust, a hold and the
  post's reaction. It is the game's choreography, not something faked for the test.
- Both backends draw the same board. I measured a desktop GPU only, so nothing here says how a tablet does.

What looks weak:

- **The seam between figure and world.** Bo is crisp pixel art with hard edges on a painted, softly lit
  ground. Beside the houses he looks a little pasted, and the target does so more.
- The target's art is the weakest piece: a clean-outlined generated sprite on a square pad of dirt,
  with none of the painting's grain. It needs a painted pass or a different source to belong.
- The effect is small for a "hero" move: the rock is about a third of Bo's height, the dust is a puff, and
  the board kick is subtle at this zoom. Impact reads, but it is not a moment.
- The reaction is only an offset. There is no hit flash on the post (a scenery piece cannot take the
  unit flash) and no damaged state.
- Bo's walk and idle are fine but stiff next to the painting's richness; I judged that from stills and the
  stroll timing, not frame by frame.

What the 2D route would need to look clearly better:

1. Put figures and props through the same painted finish as the plates (a unified grade or a painted
   pass), which is a pipeline step, not another generation.
2. A proper prop route: a gated recipe for props (palette, edge, light, contact) like the G recipe for
   figures, plus reaction states for them.
3. Larger, layered effects for a signature move: more cels, persistent debris and ground damage, a stronger
   kick, driven by the same choreography.
4. More frames or a skeleton-driven pose set where a move needs to read at tablet size.

## Files

`dev/style-test-2d.html`, `src/dev/styleTest2d.ts`, `dev/assets/style-test/dummy.png`,
`scripts/style-test-2d-capture.ts` (`perf`, `video`, `frames`; `STYLE_TEST_GPU=1` asks for the real GPU),
and under `docs/style-test/`: `layout.md`, `layout.jpg`, `2d-report.md`, `play-2d.webm` (33 s, 1366x1024,
WebGL on the GPU), `perf-2d-gpu.json`, `perf-2d-software-gl.json`.
