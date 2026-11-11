# Save validation and corrupt combat cursors (#485)

Owner: Codex, branch `codex/save-fuzz-485`. The live claim and validation receipts
belong to [#485](https://github.com/jaredbahr/Avatarrpg/issues/485#issuecomment-6717111711).

A real combat save with only `state.battle.turnIndex` changed to `0.5` previously
loaded successfully. The battle remained active but had no current actor, so
neither player controls nor AI could advance it. The same problem occurs with a
negative or out-of-range cursor, an empty order, or an unknown current unit.

The loader now requires a nonnegative integer cursor and a known current actor
for active battles. Invalid files return the existing damaged-save message before
the application adopts any state. A known dead actor still loads: the existing
battle reconciliation advances its turn or settles the outcome.

The seeded fuzz test exercises real fresh, exploration, combat and post-Driller
fixture saves. Accepted mutations pass through the application's reconciliation
steps and must support a real legal command. Explicit controls check normal saves,
active-turn ownership and prototype safety. The complete mutation workload has an
asserted 20-second budget; its source contains the exact case count and seeds.

## Reproduction and acceptance

1. Save during a party turn in the Forest Road fight, and keep an untouched copy.
2. In a copy, set `state.battle.turnIndex` to `0.5` without changing any other field.
3. Start a different game. Open Pause → Load game → Import from file and choose
   the damaged copy. The load sheet should stay open, report the damaged turn
   cursor, and preserve the complete running state and session.
4. Import the untouched copy through the same control. It should load normally.
   Dismiss the hand-off card and use End turn, confirming unused AP if prompted.
   The battle must advance to another turn or round.

`e2e/corrupt-save.spec.ts` performs this sequence against a production build with
normal motion. The native review uses desktop Canvas, portrait touch Canvas and
desktop WebGL, explicitly checks the actual backend, captures the damaged-file
feedback and the valid loaded fight, and uses real FileReader/import controls.
The test fixture starts real games and enters the authored battle directly; it
does not play the whole story to reach that fight.

## Evidence and remaining review

The source head/tree, exact clean-head `npm run ci:local`, focused tests, native
results and actual hosted jobs are recorded in the claim and draft PR. Review
media and original failures remain outside Git at
`/workspace/avatarrpg-env/save-fuzz485/`. A local Chromium portrait is not WebKit,
Safari, a physical iPad or Home Screen/PWA acceptance. Those device checks remain
separate. No art, progression, party composition or combat rule changes belong to
this correction.
