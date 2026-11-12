# Reject fractional saved story deciders (#683)

- **Owner:** root/fractional-decider-save683, 2026-11-12; branch
  `codex/fractional-story-decider-save-683`, base `9e9f1204ee2dd52615c1eb45558d2544abd2fd78`.
- **Outcome:** reject a fractional saved story cursor before it replaces a
  playable game. Fractional participant-array indices produce an empty voter
  order, an empty tie and two disabled answers after importing that save.
- **Scope:** only `.int()` on `state.story.deciderIndex` in the save schema,
  additive parser tests, new `e2e/fractional-story-decider-save.spec.ts`, and this
  handoff. Valid rotation, unbounded integer counters and existing negative
  integer normalization are unchanged. No StoryEngine, tableVote, session,
  ConversationPanel, SaveMenu, dependency, save-version or art change.
- **Before:** actual two-player suggested setup, legal walks, Wait and Gao Talk
  reached `plant_chair`; an actual downloaded export changed only cursor 0 to
  0.5, then the real chooser/FileReader accepted it: Game loaded, empty tie,
  zero enabled/two disabled answers. The independent untouched-file import
  completed normal voting and a reducer-equivalent choice. Diagnostic one fail
  /one pass, 36.365 s, clean/stable qualified producer `6c06314c`; relevant code
  equals main `9e9`. Log `26313b0e1947a3a6b03094af03ba51a31e6d1de741e5e06734797b2bf6eb35fe`.
- **Parser RED:** before production edits on main `9e9`, with only additive
  tests uncommitted, the focused serialization file had one intended failure
  /43 passes, stable 2.543 s. The fractional cursor was accepted; valid integer
  controls already passed. Log `8e37e239abec756eb0cfa6049f97e2672f2e92f97515b901aa99bad7d49681c7`.
  Frozen tests and all original failure evidence remain retained.
- **Acceptance:** rejected real-file import keeps the complete game/session and
  every stored slot byte, keeps Load open and shows the existing plain warning.
  Native fixtures create an actual manual Slot 1 and retain the real autosave.
  The untouched download still imports and completes a normal two-player vote.
  Parser controls preserve counters 0, 1 and 7 through round-trip and ordinary
  choice rotation. Existing corruption/export assertions remain unchanged.
- **Qualification:** exact clean final-head `npm run ci:local`, the two new native
  cases plus retained corrupt-combat-cursor and actual exploration-export cases,
  then independent source/evidence review before a DRAFT push. Final head/tree,
  results and evidence are recorded in the linked PR and
  `/workspace/avatarrpg-env/fractional-decider683/`; this plan implies no unrun pass.
- **Coordination:** [issue 683](https://github.com/jaredbahr/Avatarrpg/issues/683),
  [claim 6833111161](https://github.com/jaredbahr/Avatarrpg/issues/683#issuecomment-6833111161).
  Root owns schema/handoff/integration; SOL High authored only additive tests.
  Live duplicate/PR/file/claim checks found no active serialization scope hold.
  #523's valid rotation contract is preserved; related notice 6833111521 records
  this malformed-input boundary. #529 dependency and PR310 UI scopes are excluded.
- **Transfer:** draft-only delivery. No Ready, formal approval, merge, deployment,
  installation, permission or security-policy change by this goal. Software
  Chromium and supported-command walking do not establish physical input,
  WebKit/iPadOS/PWA, device GPU/performance or owner acceptance; those stay open.
