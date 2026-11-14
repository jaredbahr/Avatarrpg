# Combo description follow-up (#667)

- **Owner / location:** `root/combo-copy667-20261112`, branch `codex/combo-copy-667`,
  based on main `b39d3e79130fe638ef48073e1e641ede3d21139f`. The integration owner records the exact tested head and publication status in the linked claim/PR.
- **Claim:** [issue comment 6823396693](https://github.com/jaredbahr/Avatarrpg/issues/667#issuecomment-6823396693),
  verified before source edits. Scope is the five ability files below and this handoff.
- **Outcome:** remove registered surface-reaction outcomes from descriptions and visible flavor
  before discovery. Fire Jab retains its 1 AP / repeated-use explanation. Fire Step and Torch Toss
  retain bare-ground qualifications, durations and the relevant landing warning.
- **Completed:** 15 description/flavor fields across 12 abilities in
  `src/content/abilities/{fire,water,earth,air,enemy}.ts`. Preserve direct Wet/lightning bonuses,
  status chances and durations, cleansing, push/position advice and all mechanical data.
  Both description and flavor appear in inspector cards, so both were audited.
- **Boundary:** optional hinted-tile markers remain outside this wording scope. They require shared
  renderer ownership, a view-model contract, both backends and parity/budget review. No core, renderer,
  asset, version, workflow, test or generated-reference changes belong to this implementation.
- **Implementation evidence:** an external TypeScript AST comparison checks every authored ability
  property except description/flavor against the base. Source tokens outside copy literals are identical;
  formatting adjusts two shortened description properties. The receipt lists every old/new string at
  `/workspace/avatarrpg-env/combo-copy667/implementation-receipt.json`; this is local evidence, not CI.
- **Verification record:** root records exact-head CI, native outcomes and failures in the linked claim/PR
  and external receipts. The implementation worker performed only formatting and source-identity checks.
  Physical device, WebKit/Safari, PWA,
  FPS, device floors and owner acceptance remain open.
- **Acceptance plan:** root reviews the copy and diff, runs existing authored-description/content/combo
  checks, inspects relevant rendered cards and aiming controls, and runs exact-head
  `ci:local` and the applicable native checks. Existing Fire Step and reaction browser specs cover legal
  landings and hint/discovery behavior. No exact-text editorial tests are needed (`docs/writing-guide.md`).
- **Transfer:** source is ready for root validation. The implementation worker has stopped editing;
  root retains integration and publication ownership. No commit, push or public metadata change occurred.
