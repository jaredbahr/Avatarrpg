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
                     ability resolution, reaction forecasting, leveling and
                     disciplines, difficulty scaling, line of sight, enemy AI
src/core/state/      createGame, the reducer (apply), the battle draft,
                     the combat log formatter
src/core/story/      story graph traversal, flags, nation standing, the
                     condition predicate DSL, the rotating decider index
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
- Encounter difficulty scales to the table in two places and only those two:
  `reinforcements` in the encounter data (more bodies above the baseline) and
  `rules/difficulty.ts` (thinner enemies and a smaller roster below it, plus
  superlinear boss HP above it). XP deliberately does not scale.
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
- Anything that tells the player what an action _will_ do must run the real rule
  on a throwaway copy, never describe it in parallel. `previewAbility` pairs
  `expectedDamage` with `rollDamage`, and `forecastReactions` replays
  `applyImpact` / `paintSurface` in effect order against a copied grid. The
  terrain preview was written by hand for the whole of Phase 1 and announced
  "Leaves Fire" over a puddle that was about to become steam. If you add an
  effect kind that changes the world, forecast it by calling the same function
  the reducer calls.
