# Fresh ballots when replacing a campaign (#671)

Owner: `root/table-vote-newgame671-20261112`, continuing
`root/table-vote-load671-20261112` on the same branch `codex/table-vote-load-671`
and draft PR672. [Claim6824180843](https://github.com/jaredbahr/Avatarrpg/issues/671#issuecomment-6824180843)
was amended and read back before this continuation's edits.

Loading a saved choice in the same page retained votes that were never saved.
The first revision introduced `resetBallot()` and called it after successful
`App.adoptSave` replacement, before pause-close/reroute callbacks. That behavior,
its unit contract, three manual Save/Load regressions and original majority,
rotation, tie and solo controls are preserved.

A later actual two-player suggested-party journey exposed the other replacement
boundary: vote on Gao's afternoon invitation, Quit to title, start a new game,
then reach that same first choice. The new campaign retained Player 2's handoff.
Its complete fresh state/session matched the first campaign except the expected
new seed and RNG. No load, adoptSave, reload, forced node, flag or cache mutation
was used. Walking used legal public commands checked against the real reducer;
setup, opening, waiting, Talk, vote and Quit/New game used actual controls.

The correction reuses the same reset API once in `App.newGame`, after the new
state/session and presentation reset, before the first story dispatch. Ordinary
rerenders and voter handoffs retain the ballot. Voting rules, save format,
reconciliation, party ownership, guidance, camera, art and styles are unchanged.

The source integrates current main `6a0c1d44ae5b013872af56fbfd33aa7a292802b9`
with the published B2 parent. PR677's assignment actually completed by merge at
16:32:17 UTC; [handoff6829424816](https://github.com/jaredbahr/Avatarrpg/pull/677#issuecomment-6829424816)
records that resolution. Its complete new-game guidance eligibility assignment
is inherited and preserved. No active owner hunk was taken on silence.

Validation covers both replacement boundaries: the original Load cases and
three new actual New game journeys starting from partial voting, unconfirmed
majority and tie. New campaigns have fresh first picks, unchanged participants
and decider; only new seed/RNG may differ in full-state comparisons. Ordinary
settings redraw retains a new partial ballot, and Continue is reducer-equivalent.
The new-game guidance eligibility flag remains set before the first forest fight.
All original 60s/10s/zero-retry oracles remain intact.

Preserved actual RED evidence:

- Load: 25.293s, log SHA256
  `0c3aeae541dbd56ca97642ace6318696fc7b9e7c59e66e0cc22cab5f3e02bc4b`;
  fresh-page Reload/Continue positive control passed.
- New game: 30.666s, solely expected fresh pick versus retained pass;
  log `b611e49cc311ea93573cdd9871cc3b616bcb3a135fa10753e7f704cc83caf4c4`.
  An initial opening-control harness failure is retained separately.

Original source, raw observations, media and reports remain outside the repo at
`/workspace/avatarrpg-env/table-vote-load671/`,
`/workspace/avatarrpg-env/newgame-vote-discovery-20261112/` and
`/workspace/avatarrpg-env/table-vote-newgame671/`. Revision-specific exact source,
CI/native results and independent review are recorded in the claim and PR.
Run the unchanged full `npm run ci:local` on the clean final head before updating
the same branch with expected remote B2; no force push or duplicate PR.

Keep draft. Physical input/device, WebKit/Safari/PWA, FPS, browser floors, owner
acceptance and broader merged runtime remain separate gates. This makes no
layout or earned-campaign claim; the walkthrough bypasses movement input using
legal reducer-checked walks. No merge, deployment, dispatch, installation,
security/credential, asset generation or budget change by this goal.
