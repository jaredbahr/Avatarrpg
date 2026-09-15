# Working in this repository

Four Nations Tactics — a hot-seat tactical RPG. Read this before changing code.

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
                     ability resolution, leveling and disciplines, difficulty
                     scaling, line of sight, enemy AI
src/core/state/      createGame, the reducer (apply), the battle draft,
                     the combat log formatter
src/core/story/      story graph traversal, flags, the rotating decider index
src/core/save/       serialise / deserialise / migrate a save blob, and
                     reconcile a loaded one against the current kits
src/core/sim/        headless combat runner used by tests and the balance report
src/content/         all game data (see schemas.ts for the shapes)
src/render/          camera, sprite cache, painters, palettes, the Renderer
                     facade, and backends/ — WebGL (Pixi + shaders) and the
                     Canvas 2D fallback
src/app/             scenes, HUD, input, hot-seat session, localStorage
```

## Commands

```bash
npm run verify   # typecheck + lint + format:check + tests. Must pass before
                 # any push — it is the same gate CI runs, minus the build.
npm test         # vitest
npm run balance  # simulator win-rate report
npm run e2e      # Playwright (builds first; uses the preinstalled Chromium)
```

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
- Touching XP, enemy rosters or `expectedLevel`? `progression.test.ts` walks the
  real story graph and asserts the party reaches every fight at the level that
  fight is tuned for, on both branches. Do not weaken it — the balance numbers
  are meaningless if the party never arrives at the level they assume.
- Encounter difficulty scales to the table in two places and only those two:
  `reinforcements` in the encounter data (more bodies above the baseline) and
  `rules/difficulty.ts` (thinner enemies and a smaller roster below it, plus
  superlinear boss HP above it). XP deliberately does not scale.
- UI sizes go in `rem`, never `px`, so the Large-text setting scales them.
  Anything tappable must be at least `var(--tap)`.
- Commit messages: imperative mood, one concern per commit.

## Things that will bite you

- `noUncheckedIndexedAccess` makes `grid[y][x]` return `Tile | undefined`. Use
  `tileAt(grid, pos)`, which returns `undefined` only for out-of-bounds.
- Statuses and cooldowns tick at the **owner's** turn start, not at round end.
- A 2-tile unit (the boss) occupies two cells; always go through
  `occupiedCells(unit)` rather than assuming one position.
- The renderer must never read game state directly — it draws from a view model
  built in `src/app/`. `Renderer` is a facade over two backends and picks one at
  construction; nothing outside `src/render/backends/` should care which.
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
