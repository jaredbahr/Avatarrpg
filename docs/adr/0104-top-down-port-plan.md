# ADR 0104: Porting the top-down PixelLab direction into the game

**Status:** accepted, 2026-11-06. The owner answered the open questions the same day (recorded under "The owner's answers" below).

Follows ADR 0103 (the top-down direction, accepted for the prototype), which asked for "its own ADR covering the camera,
tile size, renderers and the save format". Supersedes, once the default switches (phase T6): ADR 0065 (lifted tiers),
ADR 0076 and 0090 as they apply to Ba Dan's painting, ADR 0094 and 0097 (figure scale, the world-style party), and the
oblique parts of ADR 0088 and 0093. ADR 0102's principle (one crisp style, held by a test) stands; its palette rule is
amended below. Unblocks #348.

## Context

The prototype (`prototypes/topdown/`) is the whole tutorial, Ba Dan to the Driller, in the approved style. Its numbers:

- **Cells are 40 world px** (`CS = 40` in `src/b3/head.js`); terrain is 32 px Wang tiles, deliberately off the cell grid;
  figures are 48 px canvases; the Driller is a 128 px canvas on 2×2 cells. One art px is one world px.
- **Boards are the game's own grids**: the fights are the content's 20×12 rows (`levels.js` reads `maps/combat.ts`,
  `encounters.ts`, `enemies.ts`), and Ba Dan places "content cell (cx, cy) of the game's 24x16 village at world px
  (128 + 40 cx, 192 + 40 cy)" (`src/v13/geo.js`). The ground mass runs past the grid into the rim and the void.
- **Zoom is a whole number of device px per world px** (`zd = round(zc × dpr)`, `src/b3/draw.js`), shown to the owner at
  2× and 3×, with a follow camera that holds still while the action is in the middle of the view.
- **Raised rock is not lifted**: a tier's top stays on its own cells and its cut face hangs 13 px below the shelf edge
  (`Q_FACE`, `world_quarry.js`). Figures stand at the cell's foot line with no lift.
- **Grounding** is the Imagination `hardShadowMask` (`src/v13/shadow.js`), baked into the ground when a board loads;
  figures stand on `feetBlob`, a `#322125` ellipse 60 % of the body's width.
- **Ba Dan walks free**: the party moves in pixels against foot boxes and a nav grid (`objects.js` `solidAt`); the
  fights are cell-based.
- **Rules are a hand port** of `src/core/rules/` into `src/b3/rules.js`, with honest simplifications listed in its
  README ("Simplified (honest)").

The game draws an oblique (diamond) projection (`src/render/projection.ts`: `x − y, (x + y) / 2`) at 64 world px a
tile (`TILE`, `src/render/camera.ts`), lifts raised tiers a quarter tile (`TIER_LIFT`), and picks through `pickCell`.
The axis-aligned `'orthographic'` path still exists, but "only a test fixture reaches that path now" (ADR 0065).
`docs/player-view-target.md` already says what a projection change owes: "its own implementation ADR, shared
forward/inverse transforms and both-backend hit-testing coverage".

## Decision

**Port the presentation, not the prototype.** `src/core/` and the rules content do not change; the prototype's
`rules.js`, its AI and its auto-player are not ported. What moves is the art, the camera, the ground and grounding
and the combat overlays, rebuilt in `src/render/` and `src/app/` against the existing view model and both backends.

### 1. Projection and camera

- **A third projection, `'topdown'`**, is added to `Projection`, `MapDef.projection` and its schema literal
  (`schemas.ts`, which only allows `'oblique'` today). Its ground transform is the identity, like `'orthographic'`;
  what differs is the tile size and what the renderers draw. Saved positions and rule distances stay on the logical
  grid, as `projection.ts` already promises.
- **Tile size becomes per projection**: 40 world px for `'topdown'`, 64 for the rest. `TILE` is a module constant
  today; it becomes a camera property read through one helper, so `project`, `unproject`, `toScreen`, `pickTile` and
  both backends keep reading the same number.
- **No lift.** `liftAt` and `liftAlong` return 0 for `'topdown'`, `pickCell` returns the flat cell, and the lift pass
  (`liftPlan` / `liftOps`) and `reliefLift` are not used. A hanging rock face is drawn over the top of the cell
  below it and picks that cell, which is the tier the rules give it. ADR 0065's picking rule is retired with the
  oblique board, not weakened: picking stays the exact inverse of drawing.
- **Integer zoom stays** (ADR 0088), on for `'topdown'` maps. N is still device px per world px. A tile is
  `40 × N / dpr` CSS px, so `MIN_TILE_PX` (40) holds exactly when N ≥ dpr: N ≥ 1 on a 1-dpr screen, N ≥ 2 on a
  Surface (53 CSS px) or an iPad (40), and N ≥ 3 on a 3-dpr phone. `MIN_TILE_PX` and `var(--tap)` are unchanged.
- **Default zoom**: exploration at N = 3 at 1 dpr (120 px tiles, near today's 128); combat at N = 2 (80 px), with the
  prototype's hold-then-ease follow camera and Recentre zooming out to the whole board. At N = 2 a 20×12 board is
  1600×960 CSS px at 1 dpr, so **combat scrolls**. That changes the camera header's "combat never scrolls" rule and
  is question 1 below.
- **Depth order** gains a top-down key: the foot's screen y, then x (`backends/depthOrder.ts`). The existing
  scenery `footprint` and `depth` fields carry it. The occlusion reveal (ADR 0096) is kept and judged in motion.
- **Figure scale is 1.** `OBLIQUE_FIGURE_SCALE` (1.25) does not apply, so ADR 0102 rule 1 holds without a redraw.

### 2. Rendering

- **Both backends draw the top-down board.** Board-correctness parity (`backends/backend.ts`) covers terrain,
  elevation faces, blocked cells, surfaces, the reach and target washes, props and units. The CI runners take the
  Canvas 2D path, so the slice is tested there first.
- **Shadows** (ADR 0093): keep the world-pixel grid, hard edges and nearest sampling. Replace the casters:
  - **Static scenery** (houses, trees, walls, the rim): `hardShadowMask` is ported verbatim to TypeScript as a pure
    function and run by the ground packer (section 3), so the seam, contact band and 12–24 px lower-right cast are in
    the ground plates, as the prototype bakes them on load. Ba Dan's "no runtime contact, cast or join wash" rule
    carries over to every top-down map.
  - **Things that change** (breakable props, Earth Wall, the Driller's rubble): the same function, run once per image
    at load and cached, drawn as a runtime layer on both backends and dropped when the thing breaks.
  - **Figures**: `feetBlob` replaces `figureShadow`'s swept pool and the sole contact line (alpha 170 on soft ground,
    205 on paving, from the prototype). One colour, `#322125`, replaces each scene's `ink`.
- **Surfaces**: `surfvis.js`'s organic masks are rebuilt as a deterministic render module (noise seeded by cell, no
  `Math.random`), recomputed only when the surfaces change, and drawn on both backends. Fire's PixelLab flames,
  oil's sheen and steam are fidelity: WebGL animates them, and Canvas 2D draws them still. Reduce motion freezes both.
- **Combat overlays**: no grid by default. Reach is the organic wash with footprints and a destination ring; targets
  get rings and area washes. All of it is drawn from the real reachable set and `previewAbility` /
  `forecastReactions`, never from the prototype's forecast. Grid lines still appear when `showGridLines(settings)`
  says so (the Show grid and High contrast settings).
- **The void edge**: the rim and void are ground art outside the grid. `paintExtent` keeps the camera inside them,
  and each `MapEdge` with `treatment: 'exit'` must be a rim mouth in the bake (checked by the edge contract).

### 3. Content, assets and maps

- **The rules data stays where it is.** `maps/*.ts` rows and legends stay the authority for collision, elevation,
  cover and paths.
- **Presentation goes in a sibling file per map** (`src/content/scenes/<map>.topdown.ts`):
  - a terrain layer (Wang set per vertex, plus the road and court polylines and noise seeds that `geo.js` uses);
  - placed objects: sprite key, world px, footprint cells, depth and shadow kind (the prototype's `put()` calls).
- **Validation**: these files are validated by zod in `schemas.ts` (CI-only, like the rest of content; nothing in the
  shipped bundle parses them, so ADR 0060 is not touched). `validateContent` checks that footprints are on the map
  unless `exterior`, that every blocked cell is covered by a solid object or blocked terrain, and that no walkable
  cell's centre is baked as void, cliff or deep water. A visibly open path must agree with collision.
- **The ground is baked, not painted at run time**: `scripts/art/topdown/pack.ts`, deterministic with `--check` (as
  `regen.sh` is), turns the terrain layer, the Wang sets and the static shadows into lossless 1 px ground plates. They
  use the existing `scene.ground` (at most 32 images) and `scenery` machinery. The prototype's measurable checks
  become tests on the plates: shadow contrast ≥ 25 % where the ground allows it, zero halo pixels, and no straight
  terrain edge over 2 tiles.
- **Sheets**: a `topdownSheet(name)` builder in `manifest.ts` gives 48 px cels with `pixelsPerTile: 40`,
  `facing: 'both'` (PixelLab's eight drawn headings, never mirrored) and eight-way locomotion. It sits behind
  `useTopDownStyle()`, as `useWorldStyleTest()` does today. The Driller is a 2×2 sheet from its eight object views.
- **Sources and ledger**: PixelLab sources stay in `prototypes/topdown/assets/` (38 MiB, 33 of it character takes) and
  are never copied to `public/`. Only packed atlases ship (`public/art/topdown/`). `ledger.json` stays the record of
  every job, booked by each job's own usage.
- **Style contract (ADR 0102)**: amended. Measured here, the prototype's character frames (first 4,000 PNGs) hold
  3,184 distinct colours and its tiles 454, with **zero** semi-transparent pixels. Hard alpha holds, but one
  128-colour palette does not, and `art-lessons.md` records palette locks on AI frames as a failure. Recommendation:
  keep `style-contract.test.ts` for hard alpha on every listed asset, and replace the single palette with a
  per-asset colour count reported in T2 (question 4).
- **Budget (ADR 0076, 0090)**: the packed sizes are not yet measured. The self-contained `tutorial-demo.html` is
  6.5 MiB, code and base64 included. While old and new art ship side by side (T2–T6), the precache (25 MB) is at
  risk. T2 measures it and, if needed, asks for a temporary family budget in this ADR's amendment, removed at T7.
- **Retires at T7** (git history keeps it):
  - the Ba Dan region pipeline (`art/source/ba-dan-regions/`, `regen.sh`, `baDan.art.ts`, the `ground-NN` /
    `uprights-N` files, the frozen geometry);
  - the forest G1 packer and the quarry's projected pages;
  - the G1 party, bandit and resident sheets, the world-style party (ADR 0097) and `?style=world`;
  - `G1_WALK`, the brisk cadence and the unplayed jog cels;
  - the lift pass and `OBLIQUE_FIGURE_SCALE`.

### 4. Saves

**No format change.** Positions stay whole cells (`vec2` is `int` in `src/core/save/serialize.ts`), and the
projection is presentation. The style choice is a URL flag and then a default, never `GameState`. If a phase adds a
field to `GameState` or `BattleState` (for example a sub-cell exploration position, question 2), it goes into
`serialize.ts`'s schema in the same change, or a loaded mid-battle save crashes; `serialize.test.ts` holds it.

### 5. Tests that pin the old look

The rule each test protects survives; the numbers it pins move with the art. No test in `src/core/`,
`progression.test.ts`, `serialize.test.ts` or the balance report changes.

| Test                                              | At the switch (T6)                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/viewport.spec.ts`                            | Kept: the camera is measured from the canvas on both projections. Tile-to-pixel goes through `e2e/projection.ts`.               |
| `e2e/renderer.spec.ts`                            | Kept for both backends; expectations rewritten for top-down. A new spec taps every cell of a slice board on both backends.      |
| `cameraIntegerZoom`, `camera`, `projection` tests | Extended with `'topdown'` cases (forward/inverse, N ≥ dpr); the oblique cases go at T7.                                         |
| `walkPace.test.ts`                                | Rewritten: pace fitted per family to the PixelLab walk's drawn feet; the no-slide tolerance stays. `G1_WALK` values go.         |
| `sheets/feet.test.ts`                             | Kept: every standing and walking cel on its lowest sole, ±1 world px, now over the top-down sheets.                             |
| `actorGrounding`, `propGrounding`                 | Rewritten to the new contract: `feetBlob` under every figure, a `hardShadowMask` seam, contact and cast for every prop.         |
| `baDan.test.ts`, `baDanDepth.test.ts`             | The frozen-geometry checks go with the pipeline. The depth rule (every walkable cell a sprite paints over sorts right) is kept. |
| `scripts/art/ba-dan-*.test.ts`                    | Deleted at T7 with the pipeline.                                                                                                |
| ADR 0097's 41 tests that pin G1 sheets            | Migrated to the top-down sheets at T6, the same migration ADR 0097 deferred.                                                    |

### 6. Rules: unchanged, and where the prototype differs

The game keeps `src/core/rules/`. The prototype's fights will therefore not replay move for move in the game. Where
`prototypes/topdown/src/b3/rules.js` and `combat.js` differ from `src/core/rules/` (read on 2026-11-06):

| Rule               | `src/core`                                                                                                                                  | Prototype                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Movement           | 8-way, diagonals cost the same, no corner cutting (`grid.ts`)                                                                               | 4-way                                                                   |
| Cover              | the defender's own cells are cover, or a surface that grants it; half of a big unit's footprint (`hasCover`, `damage.ts`); melee ignores it | any cover cell, wall or prop on the defender's side toward the attacker |
| Elevation to hit   | ±10 **per tier** of difference, from the firing cell; plunging fire halves the cover penalty                                                | ±10 flat; no plunging fire                                              |
| Height reach       | +1 range shooting down (`heightReachBonus`)                                                                                                 | none                                                                    |
| Ledge drop         | 3 damage (`ledgeDropDamage`)                                                                                                                | push stops; no damage                                                   |
| Crits              | crit chance, ×1.5 (`CRIT_MULTIPLIER`)                                                                                                       | none                                                                    |
| Obscurement        | steam −25 inside, −15 through, −15 from inside, an adjacent penalty, weather                                                                | −25 inside, else −15 through                                            |
| Growth, AI and RNG | leveling and disciplines; `ai.ts` with the boss script; reinforcements; `RngState`                                                          | +5 HP and +1 Power a level; one planner; none spawned; its own LCG      |

The Ruon's-order range and turn-order tie-breaks were not checked.

The port reconciles all of these by using the game's rules. The presentation must follow them: the reach wash
shows 8-way reach, and the cover ring follows `hasCover`. If the owner liked a prototype behaviour (the cover read
especially), changing it is a separate rules change under the usual tests and balance report, never part of the port.

## Plan

| Phase | Work                                                                                                                                                                                                                   | Owner sign-off                              |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| T0    | This ADR; answers to the questions below.                                                                                                                                                                              | The questions                               |
| T1    | Engine, no visible change: the `'topdown'` projection, per-projection tile, flat picking, N ≥ dpr, depth key, `?style=topdown` plumbing; camera and both-backend hit tests on a fixture board. Code only, auto-merges. | —                                           |
| T2    | The packer and the sheets: party, bandits, residents and the Driller packed from the prototype's approved takes; `topdownSheet`; the colour-count and budget measurements.                                             | Party and bandits at game zoom, in motion   |
| T3    | **Slice A: Ba Dan** behind the flag: terrain data, the baked ground with static shadows, objects, residents, talk, exits, the walk pace.                                                                               | Ba Dan in motion beside the prototype video |
| T4    | **Slice B: the Forest Road fight** behind the flag: surfaces, reach and target washes, `feetBlob`, prop shadows, PixelLab VFX, the camera and pacing, on both backends.                                                | A full fight in motion, Surface and iPad    |
| T5    | The quarry gate, the cutting, the Driller floor and the walk home.                                                                                                                                                     | Each board in motion                        |
| T6    | Switch the default; `?style=oblique` stays for one release; migrate the pinned tests; rewrite the CLAUDE.md oblique bullets.                                                                                           | The whole tutorial play-tested              |
| T7    | Retire the oblique code and art (section 3), restore the budgets, mark the superseded ADRs. Code only.                                                                                                                 | —                                           |
| T8    | Beyond the tutorial: Riverside, the interludes, the other seven heroes. Each is its own issue.                                                                                                                         | Per issue                                   |

Each phase is one issue and one PR per concern, with `npm run ci:local` green. Art PRs (T2–T5) wait for the owner's
yes, after the orchestrator has checked 3× crops and the measurable rules; code PRs (T1, T7) auto-merge.

## The owner's answers (2026-11-06)

The questions were put with a recommendation each; his answers, verbatim where short:

1. **Combat camera: zoom.** N = 2 with the hold-then-ease follow camera; combat scrolls. The camera header's "combat
   never scrolls" rule changes in T1, with Recentre zooming out to the whole board.
2. **Exploration movement: "grid is fine for now."** Grid paths drawn smoothly; whole-cell saves; no save change.
3. **Missing clips: "make them."** Hit reactions and knockouts (and the rest of the contract the port needs) are
   generated with `create-character-v3` / `skeleton-v3` in T2, booked in the ledger.
4. **Palette: "dropping the palette is fine."** ADR 0102 is amended in T2: the style contract keeps hard alpha and
   replaces the single palette with a per-asset colour count.
5. **The Switchbacks: "leave it out for now."**
6. **Cover: "yes items, characters, walls, etc provide cover. It's important because it creates the complexity of
   the gameplay."** The prototype's "something between us" cover, extended to characters standing between, becomes
   a rules change in `src/core/rules/` under its own issue, with the usual tests, the balance report and the
   forecast running the real rule. It is not part of the port, and it lands before T4 so the forest fight is judged
   with it.
7. **Pacing: "carry them over."** The prototype's measured timings and the 1×/2×/3× speed toggle are the
   starting point; the hit-stops stay.

## Amendment: budgets and the T4/T5 calls (owner, 2026-11-07)

The owner's words: "move on to the rest of the game up until the digger and back. Do another pass for visuals.
Shadows need to be seated so that objects look like they're a part of the world, not floating." Asked about the four
calls the T4/T5 plan needed, he answered:

1. **Budgets, raised permanently.**
   - The JS budget goes from 380 to **396 KB** gzipped (`scripts/check-bundle-size.mjs`). T4 and T5 add about
     13–15 KB of presentation code: organic washes, surfaces, runtime object shadows, VFX playback, and the follow
     camera and pacing.
   - The `topdown` art family gets **6 MiB** (`scripts/check-asset-budget.mjs`).
   - These budgets stay after T7. The oblique code and art that T7 removes free room under them; they don't lower
     them.
2. **Credits:** about 650 PixelLab credits, for:
   - the quarry cast's hit and knockout clips;
   - a new quarry sergeant;
   - the Driller's rumble in all eight headings, its tread loop, hit shudder and jammed knockout;
   - a few effects.

   Every job is booked in `ledger.json`.

3. **The quarry gate's `c` cells** keep the rules: they are cover you stand on. They are drawn as low cover (a short
   crate or sack line), not solid crates.
4. **Walk speed:** exploration walks at the prototype's 130 px/s (about 308 ms a tile), with cel time scaled so the
   feet never slide.

The seating rule is measurable and applies to every board and every runtime object (`ground-checks.ts`):

- no ground pixel between an object's foot and its shadow;
- contact along the whole foot;
- the cast joined to the contact;
- no hover.

## Amendment: the JS budget for the demo (owner, 2026-11-11)

The follow camera and combat pacing (#500) took the shipped JavaScript to 396.7 KB, 0.7 KB over the 396 set above:
other work landed in the room it was sized for. The rest of the demo to the quarry and back still owes code: action
clips per heading and ability (#587), in-flight projectiles (#588) and the Earth Wall rise (#590), about 3–5 KB.
`npm run bundle:report` shows no dead module worth that; the largest unmapped block is Pixi, which WebGL needs, and a
lazy chunk counts against the gate anyway (ADR 0057).

Asked, the owner raised the budget to **404 KB** gzipped (`scripts/check-bundle-size.mjs`). Like the 396 raise, it is
permanent: the oblique code T7 removes frees room under it and does not lower it.

## Note: the top-down family is not precached (orchestrator, 2026-11-10)

The quarry's three plates (#593) took the service-worker precache to 25.07 MB of 25, as §3 foresaw while the old and
new art ship side by side. No budget is raised. The top-down family is runtime-fetched, not precached, until T6
switches the default: it is only ever requested under `?style=topdown`. `scripts/precache.mjs` lists `art/topdown/**`;
workbox ignores it and `check-asset-budget.mjs` leaves it out of the precache total, while the `topdown` family keeps
its own 6 MiB budget. `scripts/precache.test.ts` pins it. T6 revisits it.

## Driller grounding implementation (#469)

The Driller packer records each static heading's tread span, center offset and baseline from
the lowest 16 opaque rows of the placed object view. Runtime grounding uses those measurements
for an opaque `feetBlob` covering the tread span, and caches the static view's `hardShadowMask`
cast independently of attack cels. Both backends emit these into their existing maximum-alpha
shadow union only on top-down boards drawing the top-down Driller atlas. Heading locomotion
uses its authored static view; the legacy east cast and its static shadow mirror together.
This adds no action loader or eight-heading action playback. Source pixels and action anchors
stay unchanged: drill contact, dust and occlusion cannot establish a new tread baseline.

## Consequences

- The oblique rules in CLAUDE.md stay authoritative until T6 and are rewritten there. Ba Dan "one continuous
  painting" and its 1 px painting stop being true at T7.
- `src/core/`, the content rules, saves, the balance report and the progression test do not move. The port is
  judged by eye, in motion, and by the same rules tests as before.
- Two art sets ship side by side from T2 to T6, so the precache budget is the main technical risk. The next risk is
  surface masks recomputed on an iPad's CPU, which T4 measures before sign-off.
- Fights in the game will differ from the prototype videos wherever section 6 says the rules differ. That is the
  intended result: the videos showed the look, and the game's rules decide the outcome.
