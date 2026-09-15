# Four Nations Tactics

A hot-seat, turn-based tactical RPG for the family — grid combat, action points,
and elemental terrain reactions, in an original era a few decades after Korra.
Up to six players share one tablet; each picks an element and a character and
levels up across a branching story.

> **Non-commercial fan work.** Avatar: The Last Airbender and The Legend of Korra
> are the property of Nickelodeon / Paramount. This is a private fan project made
> for one family to play. It is not for sale, not for distribution, and uses no
> canon characters — only original characters in a reused setting. Please do not
> sell, market, or monetise it.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

| Command            | What it does                                                       |
| ------------------ | ------------------------------------------------------------------ |
| `npm run verify`   | typecheck + lint + unit/content/sim tests (run this before a PR)   |
| `npm test`         | vitest: rules, content validation, deterministic combat sim        |
| `npm run balance`  | headless AI-vs-AI win-rate report per encounter                    |
| `npm run build`    | production build into `dist/` (includes service worker + manifest) |
| `npm run e2e`      | Playwright touch-mode end-to-end suite against the built site      |
| `npm run lint:fix` | autofix lint + layering violations where possible                  |
| `npm run format`   | Prettier over the repo                                             |

## Playing on the Surface

The game is a PWA. After a deploy, open it in Edge, then **Settings → Apps →
Install this site as an app** so it launches full-screen in landscape and works
offline (the service worker caches the whole build — no network needed once it
has loaded once).

Recommended before handing it to kids:

- **Pause → Settings → Large text** if the HUD reads small at 2736×1824.
- **Pause → Settings → Hatch surfaces** if anyone in the group has trouble
  telling the fire/mud/oil tints apart.
- **Pause → Settings → Reduce motion** if the combat playback is too busy.

Saves live in `localStorage` (3 slots + an autosave). Because that is per-browser
and per-device, use **Pause → Export save** to get a `.json` file before
switching devices or clearing browser data, and **Import save** on the other end.

## How a session runs

1. **Party setup** — pick 1–6 players; each enters a name, then picks an element
   and a character. Solo play skips the hand-off banners.
2. **Explore** — tap to walk the village, tap NPCs to talk.
3. **Combat** — each unit gets **4 AP** (non-benders get 5) and a separate
   **move** pool. Tap an ability, tap a target tile, read the hit/damage/status
   chips, confirm. Unused AP banks (1 per turn, up to 6).
4. **Story choices** — one player is named as the **decider** for each branch,
   and the role rotates. No votes, no arguments.
5. **Level up** — at levels 3 and 7 the player chooses one of two abilities.

## Elemental reactions

Terrain is a first-class weapon. The full table lives in
`src/content/combos.ts`; the ones that matter most in Act 1:

| Combination              | Result                                        |
| ------------------------ | --------------------------------------------- |
| Fire onto water          | Steam — blocks line of sight for a round      |
| Fire onto oil            | Fire that spreads one tile per round          |
| Water onto fire          | Extinguished                                  |
| Earth onto water         | Mud — costs 2 move, can Root                  |
| Cold/ice onto water      | Ice — slippery, can Freeze                    |
| **Lightning onto water** | Shocks **every** unit on the connected puddle |
| Air onto fire            | Fans it into adjacent tiles                   |
| Air onto steam           | Disperses it                                  |

Standing in fire costs 4 HP and applies Burning. Being **Wet** doubles lightning
damage and makes freezing near-certain. Teach the kids that one first.

## Architecture

Three layers, enforced by ESLint rather than by convention:

```
src/core/     Pure rules. No DOM, no Math.random, no Date.now.
              apply(state, command) -> { state, events[] }.
              Runs in Node, which is what makes the simulator and tests possible.
src/content/  Data only: abilities, characters, enemies, maps, story, assets.
              Validated by zod at load time *and* in a CI test.
src/render/   Canvas 2D drawing. One Renderer interface owns the 2D context.
src/app/      Scenes, HUD, hot-seat, storage. May import anything.
```

Data flows one way:

```
input -> Command -> core.apply() -> new GameState + Event[] -> animator -> renderer
```

The core never knows that players exist — it only knows units and factions.
Hot-seat, player names, and the rotating decider all live in `src/app/session.ts`.
That is deliberate: if we ever want phones-as-controllers, the rules do not change.

### Swapping in real art

Every drawn thing goes through `src/content/assets/manifest.ts`. Today each entry
points at a code-drawn painter (vector shapes on the nation palette). Pointing an
entry at an image URL instead swaps that art in with **no code changes**.

## Difficulty, and how it scales to your table

Encounters are authored for a party of **three** and adjust from there:

- **More than three** — one extra enemy per additional player, from a list
  authored per map. Six players against three bandits is a queue, not a fight.
- **Fewer than three** — one enemy leaves per missing player (the _last_ ones
  listed; each encounter's teaching enemy is authored first, so the deserter
  who sets the oil alight never disappears), and the rest are thinner.
- **Bosses** scale faster than linearly, because doubling the party more than
  doubles its effective output: everyone focuses the same target while the boss
  still only answers one or two of them per turn.

XP does _not_ scale. Every table earns the same per person, so everybody meets
each fight at the level it was tuned for, whatever the turnout — and both sides
of the Act 1 choice arrive at the boss with identical XP.

### Where the numbers currently sit

`npm run balance` runs every encounter many times with the AI driving both
sides. At 40 trials per encounter per table size:

| Encounter    | 1 player | 3 players | 6 players |
| ------------ | -------- | --------- | --------- |
| Forest Road  | 100%     | 100%      | 100%      |
| Quarry Gate  | 98%      | 100%      | 93%       |
| The Cutting  | 100%     | 100%      | 100%      |
| **Grumbler** | **65%**  | **58%**   | **78%**   |

Rerun it and the figures will shift a few points — the trial count picks the
seeds — but the shape holds.

That is a deliberate arc rather than a flat band: the first fight is a tutorial
and should be a near-certain win for an eight-year-old, and the boss is the one
that can actually go wrong. Note that both sides are driven by the _same_ AI,
and that AI does not set up combos — it will never soak a target so the
firebender can chain lightning through the puddle. A real party plays better
than these numbers, so treat them as a floor.

Real tuning happens after the kids play it. These are the numbers to argue with.

## Contributing notes

- `npm run verify` must be green before pushing.
- Content is validated in CI, including dangling story `next` ids and ability
  references — a typo in `src/content/**` fails the build rather than the game.
- The simulator test asserts every encounter terminates, produces no NaN or
  negative HP, and yields an identical event log for the same seed.
- `src/content/progression.test.ts` walks the real story graph and asserts the
  party arrives at every fight at the level that fight is tuned for, on both
  branches. If you change an XP value or add an encounter, it will tell you.
- The e2e suite covers the parts that only break in a browser: a save/reload
  round-trip mid-fight, the service worker serving the app with the network
  off, and every control measuring at least 48px — including at the largest
  text setting.

## Status

- **Phase 0** — scaffold, CI, GitHub Pages deploy. ✅
- **Phase 1** — playable vertical slice: party creation, village, four fights,
  one branching choice, a boss, save/load/export. ✅
- **Phase 2** — world map, Fire Nation outpost, Water Tribe and Air Temple arcs,
  more enemy types, equipment. Planned.
- **Phase 3** — tweened animation, particle FX, audio, commissioned art, haptics.
  Planned.
