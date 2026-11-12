# Quarry journal expectation (#644)

- **Updated:** 2026-11-12 UTC; owner/session `root/quarry-journal644-20261112`.
- **Outcome:** the staged quarry-return browser regression expects the approved
  Forest Road objective introduced by #637, so both routes can proceed beyond
  the first journal check. No production behavior changes.
- **Scope:** only the fixed expected-text argument in
  `e2e/quarry-return.spec.ts` and this handoff. The current expectation names the
  east road, quarry gate, roadblock and Ba Dan to the west. It is a fixed literal,
  independent of the implementation's content imports.
- **Location:** `jaredbahr/Avatarrpg`, branch `codex/quarry-journal-644`,
  `/workspace/avatarrpg-env/quarry-journal644/source`; base
  `c36ddebe1282db066b8444f5be7b314d8f05988f`. Exact qualified head/tree and draft
  publication are recorded in the live PR and external receipts after final CI.
- **Reproduction:** run the original `quarry-return.spec.ts` trade and escort
  stage-1 cases on prior main `34ab822a`. Each opens the real Travel journal and fails
  only because it expects `quarry lies east`. The rendered objective is
  `Follow the road east to the quarry gate, past the roadblock. Ba Dan is west.`
- **Acceptance:** both stage-1 cases reach their custody boundaries, and all six
  existing trade/escort cases pass. Preserve all journal controls, later stages,
  route/battle/custody checks, checkpoint projections, real Load/save/reload
  equality, rewards/revisit guards, fixtures and original 600s/10s budgets.
- **Verification snapshot:** original clean-main build passed. Original two
  stage-1 cases failed solely at the obsolete phrase; no other baseline cases
  were run. After replacing the one argument, all six candidate cases passed
  in 357.975s, with zero skipped/retried/flaky cases or global report errors.
  Removing the replacement restores the entire original test byte for byte.
- **Base advance:** owner PR662 merged difficulty settings while those candidate
  checks ran. Its 21 incoming paths are preserved verbatim on current main
  `c36ddebe`; neither this test nor its helpers changed. The original baseline
  and six candidate passes remain bound to the prior `34ab822a` producer.
  Final CI and fresh route qualification must validate the current base.
- **Evidence:** `/workspace/avatarrpg-env/quarry-journal644/` retains the original
  source, reports, PNGs, videos and complete producer/output identities. Baseline
  log SHA256 `2c05d9594054a85b366a602adb93bf976cb268f86e12f07666913a6591b88157`;
  candidate log `2da2383142c7be186377b5a39e3b751f41170adc07374b65f99a875c702cc20d`.
- **Limits:** these existing route fixtures flatten enemy HP to 1, dispatch
  legal battle/walk commands, and advance authored playback through the existing
  clock helpers. They prove route and save continuity, not battle balance,
  earned unmodified combat, real-time animation cadence or physical input.
  Rendered Chromium Canvas uses the original Surface touch profile.
- **Coordination:** [claim 6818993408](https://github.com/jaredbahr/Avatarrpg/issues/644#issuecomment-6818993408),
  following owner report 6817434517. No active open PR owns this test file;
  historical #376/PR373 is merged, and PR362 owns separate demo-flow fixtures.
  Other #644 failures and their existing owners remain separate; keep #644 open.
- **Worktree/next actions:** freeze these two paths; run exact clean final-head
  `npm run ci:local`, fresh original route cases on its actual CI output, and
  independent review. Publish only a draft with actual hosted jobs and skips.
  Candidate results do not qualify a later commit or CI output.
- **Completion/transfer:** pending final qualification/publication. Read the live
  PR and claim before edits; corrections continue the same published branch.
  Physical device, WebKit/Safari, PWA, browser floors, performance and owner
  acceptance remain open. No merge, deployment or formal approval.
