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
3. **Content is data.** Abilities, characters, enemies, maps and story nodes live
   in `src/content/` and are validated by zod schemas in `src/content/schemas.ts`.
   Adding an ability should never require touching `src/core/`.
4. **Non-commercial fan work.** Original characters only — no canon names. Keep
   the disclaimer in `README.md` intact.

## Layout

```
src/core/rules/      grid, stats, damage, status, surfaces, turn order,
                     ability resolution, leveling, difficulty scaling,
                     line of sight, enemy AI
src/core/state/      createGame, the reducer (apply), the battle draft,
                     the combat log formatter
src/core/story/      story graph traversal, flags, the rotating decider index
src/core/save/       serialise / deserialise / migrate a save blob
src/core/sim/        headless combat runner used by tests and the balance report
src/content/         all game data (see schemas.ts for the shapes)
src/render/          Canvas 2D: camera, sprite cache, painters, Renderer
src/app/             scenes, HUD, input, hot-seat session, localStorage
```

## Commands

```bash
npm run verify   # typecheck + lint + tests. Must pass before any push.
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
  owning character kit, and the content-validation test will tell you if you
  missed something.
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
  built in `src/app/`.
- Taps on the battlefield are ignored while the animator is playing. That is
  intentional, and it is why the e2e helpers have `waitForIdle`.
- Statuses that skip a turn are read _before_ statuses tick, so a 1-round Freeze
  costs exactly one turn instead of expiring on the turn it should take away.
