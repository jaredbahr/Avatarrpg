# Fresh table vote after loading (#671)

- **Owner / source:** `root/table-vote-load671-20261112`, branch `codex/table-vote-load-671`,
  based on main `b39d3e79130fe638ef48073e1e641ede3d21139f`.
- **Claim and validation record:** [issue comment 6824180843](https://github.com/jaredbahr/Avatarrpg/issues/671#issuecomment-6824180843),
  verified before edits. The live claim and eventual PR hold revision-specific check results and evidence.
- **Problem:** Save Slot 1 before voting, cast Ava's pick, then Pause → Load Slot 1 in the same page.
  The restored game/session match the save but the module-local ballot still asks to pass to Ben.
  Reload → Continue is the preserved positive control and starts at pick 1.
- **Change:** expose `resetBallot()` in `src/app/tableVote.ts`; call it only from `App.adoptSave`
  after restoring game/session and before pause-close or reroute callbacks. Ordinary rerenders and
  voter handoffs retain their existing ballot behavior. No save format, reconciliation or voting-rule change.
- **Regression coverage:** additive same-key replacement contract in `src/app/tableVote.test.ts`;
  three actual manual Save/Load journeys in `e2e/table-vote-load.spec.ts`, starting from partial voting,
  a majority result and a valid two-player tie. Check whole game/session preservation, fresh decider-first
  pick 1, absence of old names/results/ties and normal voting afterward. The partial case retains the original
  reload/Continue control and captured same-page failure oracle. Existing majority/rotation/tie/solo tests
  remain unchanged. Fixtures enter supported nodes through existing helpers; they are not earned campaign runs.
- **Baseline:** root's native partial-vote reproducer failed before this change, while its reload control passed;
  25.293 s, log SHA256 `0c3aeae541dbd56ca97642ace6318696fc7b9e7c59e66e0cc22cab5f3e02bc4b`.
  Original probe, observations and receipts remain outside the repository at
  `/workspace/avatarrpg-env/vote-load-discovery-20261112/`. Earlier harness failures are separate evidence.
- **Acceptance:** focused contracts, existing vote semantics, all three rendered journeys and exact-head
  `ci:local` must pass before publication. Native tests keep the 60 s case / 10 s assertion limits and zero
  retries. Physical/manual input, WebKit/Safari, PWA, FPS, device floors, merged runtime and owner acceptance
  remain open. This task makes no layout acceptance claim; #664's CSS work is separate.
- **Ownership:** exactly App import/adoptSave, tableVote implementation/test, the new browser spec and this
  handoff. No new-game/playback behavior, ConversationPanel, SaveMenu, core/save/schema, renderer, content,
  art, styles, versions, workflows or threshold changes. Root owns review, serialized validation and DRAFT
  publication. Implementation evidence is external at
  `/workspace/avatarrpg-env/table-vote-load671/implementation-receipt.json`.
