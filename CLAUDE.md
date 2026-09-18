# Working in this repository

Four Nations Tactics — a hot-seat tactical RPG. Read this before changing code.

For camera, interface, environment and character presentation work, also read
`docs/player-view-target.md`: it records Jared's approved long-term player views,
their interpretation and the staged delivery plan.

## Non-negotiables

1. **`src/core/` is pure.** No DOM, no `Math.random`, no `Date.now`, no imports
   from `src/render`, `src/app`, or `src/content` values. Randomness comes from
   the seeded RNG in `src/core/rng.ts` and its state is carried on `GameState`.
   ESLint enforces this; do not add disable comments to get around it.
2. **Determinism is a feature.** The same seed plus the same command sequence
   must yield the same event log. Saves, the AI, and the balance simulator all
   depend on it. If you add a source of randomness, thread `RngState` through.
3. **Content is data.** Abilities, characters, disciplines, enemies, maps and
   story nodes live in `src/content/` and are validated by zod schemas in
   `src/content/schemas.ts`. Adding an ability — or a whole discipline — should
   never require touching `src/core/`.
4. **Non-commercial fan work.** Original characters only — no canon names. Keep
   the disclaimer in `README.md` intact.

## Layout

```
src/core/rules/      grid, stats, damage, status, surfaces, turn order,
                     ability resolution, reaction forecasting, leveling and
                     disciplines, difficulty scaling, line of sight, enemy AI
src/core/state/      createGame, the reducer (apply), the battle draft,
                     the combat log formatter
src/core/story/      story graph traversal, flags, nation standing, the
                     condition predicate DSL, the rotating decider index
src/core/save/       serialise / deserialise / migrate a save blob, and
                     reconcile a loaded one against the current kits
src/core/sim/        headless combat runner used by tests and the balance report
src/content/         all game data (see schemas.ts for the shapes); story
                     splits one file per region from Phase W5
src/render/          camera, sprite cache, painters, palettes, the Renderer
                     facade, and backends/ — WebGL (Pixi + shaders) and the
                     Canvas 2D fallback
src/app/             scenes, HUD, input, hot-seat session, localStorage
docs/                roadmap, ADRs, the art bible, the device matrix
```

## Commands

```bash
npm run verify   # typecheck + lint + format:check + tests. Must pass before
                 # any push — it is the same gate CI runs, minus the build.
npm test         # vitest
npm run balance  # simulator win-rate report
npm run e2e      # Playwright (builds first; uses the preinstalled Chromium)
```

The balance report reads two environment variables: `BALANCE_SIZES=1,2,3,4,5,6`
for the table sizes to sweep and `BALANCE_VARIANTS=1` to report every roster
variant on its own line instead of averaging over whichever ones the seeds drew.
Use the second one whenever you touch a variant — an unpinned run hides a variant
that is budget-legal but win-rate-illegal inside the average.

Never run `npx playwright install` in the dev container — Chromium is already at
`PLAYWRIGHT_BROWSERS_PATH`.

## Conventions

- TypeScript strict, including `noUncheckedIndexedAccess`. Array lookups return
  `T | undefined`; use the helpers in `src/core/rules/grid.ts` (`tileAt`,
  `unitAt`, `occupiedCells`) and `BattleDraft.unit()` rather than `!`.
- The reducer is `apply(state, command) => { state, events }`. It returns a new
  state; it never mutates the one passed in. Presentation reads the events.
- New abilities: add the data in `src/content/abilities/`, add the id to the
  owning character kit or discipline kit, and the content-validation test will
  tell you if you missed something.
- **Disciplines** (`src/content/disciplines.ts`) are the paths a character
  commits to at level 5. A character kit runs 1, 2, 3, 5 and stops — a flat
  grant at 1 and 2, a choice at 3, the `specialize` gate at 5 — and the chosen
  path supplies levels 5, 7 and 10. Two rules are enforced by
  `validateContent`, not by convention: every element keeps at least one path
  with `requiresFlag: null`, so a table that skipped the optional story still
  has something to take; and no two paths grant the same ability. Rarity is a
  story flag, never a roll.
- A new discipline needs nothing in `src/core/`. It needs a `DisciplineDef`, its
  abilities, and its id in the `specialize` list of both characters of its
  element.
- Touching XP, enemy rosters or `expectedLevel`? `progression.test.ts` enumerates
  every route through the story graph — both branches, every gated option, and
  every single-loss path — for a party that can take every gated option and one
  that can take almost none, and asserts the party reaches each fight at the
  level that fight is tuned for. Do not weaken it: the balance numbers are
  meaningless if the party never arrives at the level they assume. In particular
  do not reintroduce a single global "pick option N" index — with a three-option
  node it falls through to option 0 and the test passes while testing nothing.
  ADR 0011 rewrites this test over the **region graph** when Phase W1 lands —
  asserting the party enters each region inside its level band, rather than
  reaching each fight at an exact level. That is a change of premise, not a
  weakening: both warnings above survive it verbatim.
- Encounter difficulty scales to the table in two places and only those two:
  `reinforcements` in the encounter data (more bodies above the baseline) and
  `rules/difficulty.ts` (thinner enemies and a smaller roster below it, plus
  superlinear boss HP above it). XP deliberately does not scale. From Phase W1,
  `difficulty.ts` also absorbs the ±2 levels of slop a free-roam region allows
  (ADR 0011) — that is the same file, not a third lever, and region entry stays
  hard-gated by a `Condition` on the exit.
- **Roster variants are not a third scaling lever.** `EncounterDef.variants`
  changes _which_ enemies turn up, never how many relative to the table: the
  under-strength trim, flag-gated additions and reinforcements all still layer on
  top. `validateContent` holds every variant within 10% of the authored roster's
  summed enemy XP, which is what keeps them comparable — and because `xpRoster`
  always pays from the authored roster whichever variant spawned, budget-matched
  variants are XP-identical by construction.
- New content gates go through `Condition` (`src/core/story/conditions.ts`),
  never through a bare flag lookup. It is plain data, so it validates, saves and
  can be described back to the player — which the dialogue UI needs, because it
  draws options the party _cannot_ take and has to say why.
- UI sizes go in `rem`, never `px`, so the Large-text setting scales them.
  Anything tappable must be at least `var(--tap)`. The one exception is
  `--hairline`, the decorative outline, which is px on purpose so it does not
  thicken with the type.
- Every colour, type size, z-index, duration and easing is a token in the
  `:root` block of `src/styles/base.css`; nothing outside it writes a literal.
  A tint of a palette colour is `color-mix(in srgb, var(--c-x) N%, transparent)`,
  never a second copy of the value. Tag a component `.element-<id>` and draw
  with `--el` rather than adding a rule per element (ADR 0005).
- Scene changes go through `App.showScene`, which stays synchronous: the
  curtain reveals _after_ the swap and never takes a tap. The backdrop's tint
  is `app.setMood()`; a scene that knows better than the map (a speaker's
  element, the path being picked) calls it from its `render()`.
- Commit messages: imperative mood, one concern per commit.
- **Work auto-merges once it is ready.** Nothing waits on a human clicking the
  button: open the PR, then turn on auto-merge so it lands the moment CI is
  green. Ready means `npm run verify` passed locally, the PR has no conflict
  with `main`, and any review comment on it is addressed — CI is the last gate,
  not a second opinion. Merge with a merge commit, not a squash: the history is
  one-concern commits and it stays that way.
  This is Jared's standing instruction for **all agents**, also recorded in
  `AGENTS.md`. Use the latest commit's checks, address conflicts and review
  feedback, and never bypass a failing or missing check. A rejected auto-merge
  request is a blocker to investigate, not a reason to ask for routine merge
  approval again.
- Anything that changes an engine, a rendering contract, an asset format or a
  budget gets an ADR in `docs/adr/`. The phase plan is `docs/roadmap.md`; art
  is generated against `docs/art-bible.md`; a new device is checked against
  `docs/device-matrix.md`.
- Backends: board-correctness parity is mandatory, fidelity parity is not
  (`src/render/backends/backend.ts`). Draw anything the rules care about on
  both backends; particles and shader effects are WebGL-only by design.

## Things that will bite you

- `noUncheckedIndexedAccess` makes `grid[y][x]` return `Tile | undefined`. Use
  `tileAt(grid, pos)`, which returns `undefined` only for out-of-bounds.
- Statuses and cooldowns tick at the **owner's** turn start, not at round end.
- A 2-tile unit (the boss) occupies two cells; always go through
  `occupiedCells(unit)` rather than assuming one position.
- The renderer must never read game state directly — it draws from a view model
  built in `src/app/`. `Renderer` is a facade over two backends and picks one at
  construction; nothing outside `src/render/backends/` should care which.
- **The camera must be measured from the canvas element, never once at mount.**
  The map is the only thing that flexes, so its height is whatever the turn
  strip and the HUD leave it — and both fill in _after_ the scene mounts, none of
  it firing a window `resize`. A stale measurement is not just a stale camera:
  `Renderer.resize` sizes the backing store from the same numbers, so the
  browser scales the frame to the box it really has and everything drawn drifts
  from the pointer coordinate it was computed for, by more the further down the
  map you go. That is why the hover highlight sat two tiles above the cursor.
  `Renderer` now keeps a `ResizeObserver` on the canvas and calls
  `onViewportChange` so the scene can re-fit; do not replace it with an event
  listener. `e2e/viewport.spec.ts` holds the line, and note why it has to: every
  other spec maps tile -> pixel through the same camera the tap handler reads,
  so both were wrong in the same direction and the taps still landed.
- The backend choice asks whether WebGL is **accelerated**, not whether it
  exists. Measured here, a software rasteriser runs the board at 6fps where
  Canvas 2D holds 60 — and that is not the shader's fault, since removing it
  entirely changes nothing. CI runners have no GPU, so they take the 2D path.
  `?renderer=webgl` or `?renderer=canvas` forces one, which is how
  `e2e/renderer.spec.ts` covers both.
- Four Pixi v8 behaviours that fail **silently** — all four cost a debugging
  cycle, and all four are commented at the point they bite:
  - `GlProgram` picks GLSL ES 3.00 by string-matching `#version 300 es` in the
    fragment source. Omit it and the shader links as WebGL1 and draws nothing.
  - `UniformGroup.uniforms` is a plain object. Neither assignment nor in-place
    mutation marks it dirty; you must call `update()` or every uniform keeps its
    constructor default.
  - A Filter renders only the clipped **visible** bounds of its target, so UVs
    do not span an object that runs off screen.
  - Assigning `filter.resources` after construction does not rebuild the bind
    group; create the texture before the filter and update it in place.
- Taps on the battlefield are ignored while the animator is playing. That is
  intentional, and it is why the e2e helpers have `waitForIdle`.
- Statuses that skip a turn are read _before_ statuses tick, so a 1-round Freeze
  costs exactly one turn instead of expiring on the turn it should take away.
- **Nation standing is stored in `flags` under a reserved `standing.` prefix, and
  0 is falsy.** Every flag reader older than conditions tests truthiness, so a
  `branch` node or a `conditionalEnemies` group pointing at a standing key reads
  neutral as "unset" and silently takes the wrong road. `validateContent` rejects
  both; go through `getStanding`/`adjustStanding` and the `standing` condition.
- **Adding a field to `GameState` or `BattleState` means adding it to the zod
  schema in `src/core/save/serialize.ts`.** zod strips unknown keys and `toBlob`
  writes through an unchecked cast, so a forgotten field serialises fine, parses
  back as `undefined`, and crashes only on a loaded mid-battle save.
  `serialize.test.ts` deep-compares a real mid-battle round trip to catch it.
- A prop bakes its `blocksMove` / `blocksSight` / `grantsCover` into the `Tile`
  and journals the tile it replaced, exactly as `raiseWall` does. That is why
  movement, sight, cover and AI positioning need no knowledge of props at all —
  but it also means `paintSurface` will not paint a _solid_ prop's own tile, so
  a burning prop reads its exposure from the neighbouring tiles.
- Prop damage resolves **before** `draft.impact` in the damage effect. Reversed,
  a fireball that cracks an oil flask spills oil into a tile the flames have
  already passed through and nothing lights.
- `previewAbility` consumes no RNG, and the AI's `scoreAbility` must not either.
  That is why damage to props is flat, with no to-hit roll or crit.
- **Sprite cache sizes are device pixels.** Pass CSS size × `dpr`, or the
  sprite comes out soft on a Surface or an iPad. Both the sprite cache and the
  Pixi texture map are bounded LRUs because iOS caps canvas memory; do not
  hold a texture from `Texture.from` outside that map, and always pass
  `skipCache` so a destroyed texture is never handed back for its canvas.
- **A refit must not eat a pinch zoom.** The `Renderer`'s observer calls the
  scene's `onViewportChange` after every canvas box change, and the HUD
  changes that box on most turns. `CombatScene.refit()` refits only when the
  board was fitted, or a rotation has left it smaller than it could be, and
  otherwise clamps; never wire `onViewportChange` straight to `camera.fit()`.
- **iPadOS ignores the manifest's `orientation`.** Portrait has to work. Where
  the fitted tile would drop below `MIN_TILE_PX`, `Camera.fit()` fits to a
  tappable tile and pans instead; that is the one exception to "combat never
  scrolls", and the camera header explains it.
- **`navigator.vibrate` does not exist on iOS.** Keep it optional-chained; never
  make a gesture depend on the buzz.
- **The WebKit iPad Playwright projects exist only in CI** (or with
  `FNT_E2E_WEBKIT=1`). The dev container has Chromium alone; never run
  `playwright install` there. Playwright's WebKit is the engine, not Safari:
  Home Screen behaviour stays on the manual checklist.
- **Pinch cannot be synthesised by Playwright.** `e2e/gestures.spec.ts`
  dispatches two-pointer `PointerEvent`s at the canvas instead, which is why
  the pointer adapter guards `setPointerCapture` in a try/catch.
- Anything that tells the player what an action _will_ do must run the real rule
  on a throwaway copy, never describe it in parallel. `previewAbility` pairs
  `expectedDamage` with `rollDamage`, and `forecastReactions` replays
  `applyImpact` / `paintSurface` in effect order against a copied grid. The
  terrain preview was written by hand for the whole of Phase 1 and announced
  "Leaves Fire" over a puddle that was about to become steam. If you add an
  effect kind that changes the world, forecast it by calling the same function
  the reducer calls.
