# Versioned campaign save corpus (#486)

- **Owner:** Codex continuous gameplay session `golden-saves486-20261108`,
  root integration owner, branch `codex/golden-saves-486` from
  `1c273d2a004456679d3cdb5949773b5e864eaeff`.
  [Verified claim](https://github.com/jaredbahr/Avatarrpg/issues/486#issuecomment-6720481756).
- **Outcome:** eighteen version-5 saves cover one- and four-player sessions at
  the opening, Ba Dan, before/after the forest fight, quarry gate, Cutting,
  active mid-Driller fight, Driller victory and homecoming. Files total 317,130
  UTF-8 bytes; the largest is 70,474 bytes, below the 200,000-byte per-file limit.
  These rosters are test data and do not change player defaults or party design.
- **Generator:** `node --import tsx scripts/saves/make-golden.ts`, optionally
  `--out-dir <isolated-directory>`. Fixed seeds, timestamp, names and session
  bindings; actual core dialogue, choices, authored map exits, rewards and
  homecoming. The owner-permitted forced-victory adapter changes enemy HP and
  battle phase, then uses real `resolveBattle`. Mid-Driller snapshots precede
  that adapter after three real turn commands. Forced victories do not prove
  battle balance or a legally won campaign. A legitimate null inter-map cursor
  is anchored through the existing same-map exploration command, with position,
  map, RNG and flag preservation asserted.
- **Permanent compatibility:** create a NEW schema-version folder on a version
  bump and keep every old folder/fixture forever. The writer preflights all
  outputs, refuses different existing bytes, leaves identical files untouched
  and creates missing files exclusively. Repository Prettier configuration
  formats generated JSON; final formatted sizes are checked. Importing the
  script does not write files. Never regenerate old snapshots to hide a failed
  migration.
- **Regression checks:** discover all JSON fixtures in every version folder;
  deserialize, perform App-order battle/discipline/world reconciliation with
  no warnings, resolve the story node, verify session/party and independent
  checkpoint identities, then execute one legal command with semantic progress.
  Exploration uses actual grid/pathfinding and resolved occupancy. Active battle
  order, cleared encounters, XP, escort choice and all five returning/resting
  residents are checked. Two in-memory generations must match without changing
  historical files; current CLI byte equality is verified separately.
- **Evidence:** two formatted isolated generations are byte-identical and
  semantically equal to the preserved initial compact outputs. Default rerun
  writes zero files; a changed-file negative control refuses before partial
  writes. The focused corpus run initially exposed six test-driver failures
  from an unsupported command; corrected real walking retains the legal-command
  requirement. Earlier generator guards mishandled message-only reward success
  and null inter-map cursors. A scoped format check rejected compact JSON, then
  the generator was corrected to the required formatter. All original failures,
  source copies, receipts and regenerated output comparisons remain under
  `/workspace/avatarrpg-env/golden-saves486/`; no production core or acceptance
  threshold was changed.
- **Scope/review:** SOL High Standard owns only the new generator; root owns
  the test, eighteen JSON files, this handoff and serialized verification.
  Existing save/core/story/content helpers, pinned quarry fixtures and other
  workers' files remain read-only. No art, schema, runtime behavior, dependency
  or configuration change. Root/SOL source review found no blocking concern.
- **Final acceptance:** the draft PR records the exact clean final commit/tree,
  full `npm run ci:local`, actual hosted jobs including skips and any supplemental
  production-browser imports/continuations. This handoff does not predeclare
  pending checks passed. Browser emulation does not establish physical input,
  WebKit, hardware performance, listening or Home Screen/PWA acceptance.
- **Resume:** inspect the live claim/head/jobs before corrections, keep them on
  the same draft branch, and bind fresh evidence to the corrected final head.
  Shared byte-identical ignored caches are frozen; detach before future writes.
  Draft only; no merge, deployment, workflow dispatch, installation, asset
  generation or security/credential change.
