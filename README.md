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
| `npm run verify`   | typecheck + lint + format + unit/content/sim tests (before a PR)   |
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

Water will _not_ wash oil away — it floats, and the log says so. To clear an oil
slick you burn it off early, while nobody is standing in it.

## Things on the battlefield

Maps carry props: water barrels, oil flasks, braziers, hay bales, rubble, and a
cabbage cart. They are a delivery mechanism for the table above — a barrel does
not know what Wet is, it spills water and the reaction table does the rest.

Every party member has **Shove** without spending a kit slot, which is the point:
props have to be usable by the nonbender, by the person who has spent all their
AP, and by the five-year-old. "I pushed the barrel into him" is a complete and
powerful turn.

The quarry gate is built around one such play. The brazier sits one tile west of
the oil stripe, so a single Shove tips it into the channel and lights the lot —
the best move on the board, available to the least experienced person at the
table, and genuinely dangerous to whoever is standing too close.

## Who does the talking

Dialogue options can be gated on the party you brought, and **every option is
shown whether or not you can take it** — the ones you cannot are dimmed and say
why. Seeing that a firebender could have talked their way through a gate is what
makes somebody want to play it again with a different four people.

An available option is tagged with the party member who would say it ("Kaya ·
Firebending"), so choosing it _is_ choosing who walks up. That is the whole
Speaker Choice: no extra step, and the rotating decider already decides who makes
the call.

Nations remember. Handing a prisoner to a court rather than to a mercenary moves
Earth Kingdom standing, and standing gates later conversations.

## Losing

A wipe does not reload the fight. You wake on the verge with your pockets turned
out and go up the hill anyway; the gate opens because somebody decided you were
not worth the barrels; Ruon carries three of you out of the cutting and Jin gets
what she came for. Every defeat branch carries the XP the fight would have paid,
so losing costs you the story rather than the level — nobody gets left behind and
nobody has to replay a fight they just lost.

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
each fight at the level it was tuned for, whatever the turnout — and every route
through the act arrives at any given fight with identical XP, including the ones
that lose a fight or talk their way past one.

**Roster variants are not a third lever.** A fight can have several authored
rosters and the seed draws between them, but each must cost within 10% of the
authored roster in summed enemy XP — checked by `validateContent`, not by
hoping. The forest road has three at exactly 300: two thugs and a slinger, three
slingers, or two bruisers. Same price, three different problems. Because XP is
always paid from the authored roster whichever one spawns, they are worth
identical XP by construction.

### Where the numbers currently sit

`npm run balance` runs every encounter many times with the AI driving both
sides. `BALANCE_SIZES` picks the table sizes and `BALANCE_VARIANTS=1` reports
each roster variant separately. At 60 trials per encounter per table size:

| Encounter              | 1 player | 3 players | 4 players | 6 players |
| ---------------------- | -------- | --------- | --------- | --------- |
| Forest Road (thugs)    | 100%     | 100%      | 100%      | 100%      |
| Forest Road (slingers) | 100%     | 100%      | 100%      | 100%      |
| Forest Road (bruisers) | 100%     | 100%      | 100%      | 100%      |
| Quarry Gate            | 100%     | 99%       | **70%**   | 98%       |
| Quarry Gate (bluffed)  | 100%     | 96%       | 48%       | 100%      |
| The Cutting            | 100%     | 100%      | 100%      | 100%      |
| **Grumbler**           | **57%**  | **50%**   | **63%**   | **60%**   |

Rerun it and most figures shift a few points — the trial count picks the seeds —
but the shape holds. The four-player quarry gate genuinely is the dip rather
than noise: it reads 70%, 71%, 68% and 70% at 40, 80, 200 and 400 trials.

That dip is the props, and specifically the brazier. At four players the same
fight reads 90% with an empty map and 70% with the props on it, and isolating
them at 150 trials each puts almost all of it in one place:

| Quarry gate, 4 players  | Win % |
| ----------------------- | ----- |
| all four props          | 70.0% |
| without the cart        | 71.3% |
| without the oil flask   | 72.7% |
| **without the brazier** | 83.3% |
| barrels only            | 82.0% |
| no props at all         | 90.0% |

It is being kept anyway, for two reasons. 70% is inside the target band — it is
the best-tuned size on the board, and the table sizes either side of it are the
ones sitting _above_ band. And the simulator is the worst possible user of a
brazier: it will tip one into the oil while standing next to it, where a real
party picks the moment. Props widen the gap between this floor and real play
more than anything else in the game, so the number is both worse and less
representative than it was before they existed.

If it turns out to be genuinely unfair at the table, the cheap lever is moving
the brazier one tile further from the oil — that makes lighting the channel a
two-step setup instead of a single Shove, and `props.test.ts` asserts the play
end to end, so it will fail loudly and tell you what you changed.

The three forest-road variants all win, but they do not play alike — at six
players the thugs cost 1.4 knockdowns, the all-ranged squad 2.5, and the two
bruisers 0.8, for exactly the same XP. That difference is the whole point of
variants.

That is a deliberate arc rather than a flat band: the first fight is a tutorial
and should be a near-certain win for an eight-year-old, and the boss is the one
that can actually go wrong. Note that both sides are driven by the _same_ AI,
and that AI does not set up combos — it will never soak a target so the
firebender can chain lightning through the puddle. It is also blunt about props:
it will break a barrel it is standing next to. A real party plays better than
these numbers, so treat them as a floor.

Real tuning happens after the kids play it. These are the numbers to argue with.

## Contributing notes

- `npm run verify` must be green before pushing.
- Content is validated in CI, including dangling story `next` ids and ability
  references — a typo in `src/content/**` fails the build rather than the game.
- The simulator test asserts every encounter terminates, produces no NaN or
  negative HP, and yields an identical event log for the same seed.
- `src/content/progression.test.ts` enumerates every route through the real story
  graph — both branches, every condition-gated option, and every path that loses
  one fight — for a party that can take every gated option and one that can take
  almost none, and asserts the party arrives at each fight at the level that
  fight is tuned for. If you change an XP value, add an encounter, or add a
  defeat branch without compensating XP, it will tell you which route broke.
- `src/core/save/serialize.test.ts` deep-compares a real mid-battle save through
  a round trip. zod strips unknown keys, so a field added to `GameState` and not
  to the save schema would otherwise fail only on somebody else's tablet.
- The e2e suite covers the parts that only break in a browser: a save/reload
  round-trip mid-fight, the service worker serving the app with the network
  off, and every control measuring at least 48px — including at the largest
  text setting.

## Status

- **Phase 0** — scaffold, CI, GitHub Pages deploy. ✅
- **Phase 1** — playable vertical slice: party creation, village, four fights,
  one branching choice, a boss, save/load/export. ✅
- **Phase 1.5** — replayability systems: interactable props, seeded roster
  variants, speaker-aware dialogue with condition-gated options, nation standing,
  and defeat that branches the story instead of reloading. ✅
- **Phase 2** — world map, Fire Nation outpost, Water Tribe and Air Temple arcs,
  more enemy types, equipment. Planned. (Deliberately _after_ 1.5: authoring
  three arcs against the old schemas and retrofitting branching afterwards would
  mean authoring them twice.)
- **Phase 3** — tweened animation, particle FX, audio, commissioned art, haptics.
  Planned.
