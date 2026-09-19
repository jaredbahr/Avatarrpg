# Setup copy factual correction

- Branch: `codex/setup-copy-factual`, based on `origin/main` at `44ed3f6`.
- Scope: `src/content/elements.ts` only. Corrected the five element setup cards
  and their internal balance comments; no rules, abilities, story, or character
  identity changes.
- Rule basis: water surfaces apply Wet on entry; Wet doubles lightning damage
  and cold can freeze water; mud costs extra movement and can root; air pushes
  and pulls and can scatter fire or steam; non-benders have 5 AP (not an extra
  action) and Chi Block prevents bending for its duration when it lands.
- Validation: focused content/prompts tests passed (35 tests). `npm run verify`
  passed typecheck, lint, formatting, and 689 tests across 72 files.
- Integration: local commit only; gameplay/orchestrator should cherry-pick this
  commit into the next environment batch. No push and no separate CI run.

## Follow-on ability/help audit

- The Water Whip tooltip now says it can soak a target and points to lightning
  or cold, reflecting its 75% Wet chance and the available reactions.
- Water ability flavor no longer assigns lightning to a firebender, and the Wet
  status and forest tutorial now describe cold as stronger rather than claiming
  that Wet makes freezing nearly certain.
- Existing oil-enemy wording correction `d72299e` was left untouched to avoid
  duplicating that owner’s work.
- Follow-on validation: `npm run verify` passed 689 tests across 72 files.

## Return discovery payoffs

- New commit after the factual-copy commits: revisit variants for
  `duck_nest`, `runoff_marker`, and `tea_station` when `act1_complete` is set.
- The nest remains untouched and protected by fresh reeds and a cloth marker;
  runoff remains visibly cloudy while stakes and fresh measurements mark work
  planned for when the crews are fit; the tea station now shows the crews have
  passed through and finished the tea, matching Sen’s return scene.
- First-time discovery lines, flags, routes, and pre-rescue revisits are
  unchanged. `src/content/story/return.test.ts` covers before/after variants;
  focused discovery/return tests pass (16 tests).
- Full follow-on validation: `npm run verify` passed 690 tests across 72 files.

## Driller tip correction

- The boss tip now reflects `cold-into-mud`: cold turns mud into ice with no
  guaranteed stop or root. It tells players to keep the party clear before
  lighting oil while allowing the blaze to catch the driller; no combat values
  changed. The final player-facing wording tells players to catch the driller in
  burning oil while keeping their party clear, and to use Ice Path for crossing
  mud rather than immobilizing the treads.

## Driller continuity payoff

- `quarry_assessment` now gives the trapped workers a human callback: one calls
  for Grumbler by name before the fight. The driver remains the named enemy; no
  new speaker or lore is introduced.
- The existing spared/traded `mira_epilogue` variants now carry the Republic City
  maker-plate rubbing into Mira’s province report. The traded branch keeps its
  unresolved Jin delivery question; no machinery state is invented.
- Focused branch/content/variant tests pass (46 tests). No new region, battle,
  flag, reward, or route was added.
