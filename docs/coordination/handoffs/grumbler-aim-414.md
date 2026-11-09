# Highlighted Grumbler target cells (#414)

## 2026-11-04: ownership released; correction carried in draft PR357

Claude's handback6619057280 and the latest #348 map release the original onTap
hunk hold. Root's updated claim6610205734 and issue328 claim6620986707 were
verified before editing. This issue continues in existing PR357, with no new PR.
The isolated local source is `/workspace/avatarrpg-env/enemy-overview-gates328/source`;
the original test-only candidate `12d373d7` and its raw failures remain preserved.

The exact four-file candidate was cherry-picked after the reviewed main merge.
Its 82 public commands, checkpoint participants and save SHA256 remain unchanged
on current content. Before the production correction, eight scene cases yielded
one genuine raw far-cell failure and seven controls; 28 frame/overview cases
also passed. After adding existing `resolveAim` to the actual onTap acceptance
boundary, all 36 pass. Another 99 related body-picking, camera, pause, lifecycle,
victory and core-aim cases pass. This is wiring to the existing contract, not a
new combat rule or a fabricated reachable cell.

Move, area/tile, invalid empty and one-cell behavior retains its existing path.
Overview return-only handling and protected pointer/body resolution still occur
before normalization. The native Canvas/WebGL fixture retains all corner,
preview, dispatch, target identity, AP/damage and whole-state controls; its only
protocol change is replacing unsupported mouse wheel with the same canvas wheel
event. No old assertion, budget or retry setting is relaxed.

Final exact-head CI and native results will be recorded in PR357 and the external
correction receipts before any push. Preserve original failures separately; local Chromium does not prove
WebKit, Safari/PWA, physical input or performance acceptance. No new media,
assets, core rules, renderer geometry, shared helpers, dependencies, generated
art, merge, deployment, dispatch, install or security change is part of this fix.

The record below describes the original conditional candidate and its failures.

Owner: Codex root, session `grumbler-aim414-20261103`.
Branch: `codex/grumbler-aim-414`, based on main `207c8eec`.
Claim: [6610205734](https://github.com/jaredbahr/Avatarrpg/issues/414#issuecomment-6610205734).

## Finding and existing contract

The target overlay uses `resolveAim`, but the actual scene tap handler retains
the raw tile and validates it directly. A far Grumbler footprint cell therefore
highlights and then says “Out of range” with disabled Confirm, while the near
cell is legal. This is missing wiring for the contract already established by
PR193, not a new combat targeting rule.

The canonical trade campaign supplies a real example after 82 accepted commands:
Grumbler round2, Kaya7,1/AP1 and Grumbler12,7/HP131. Fire Jab can reach12,7 using
the existing elevation bonus; highlighted12,8 is outside raw range. The fixture
helper replays public commands without changing positions, HP, AP, kits, RNG or
outcomes and verifies exact official save reconciliation. The save SHA256 is
`0faca5cfc37d74f16f1eeba5b9cb57d233b362465eaa9c4337138a9bcb781843`.

A production Canvas discovery witness confirms actual rendered target inclusion,
real far tap, raw pending12,8, disabled Confirm and unchanged whole game state.
The same case taps near12,7, confirms a normal Fire Jab and observes AP1→0 and
boss HP131→130. No page errors. This is App.adoptSave API staging from a legally
earned save, not the Load UI, uninterrupted browser campaign or physical-device
acceptance. The initial wrong probe expectation that Confirm was absent rather
than disabled is retained separately as a harness failure.

## Scope and current ownership boundary

Only new isolated files are claimed: the canonical checkpoint helper,
`combatAim.test.ts`, `grumbler-aim.spec.ts` and this human handoff.

**Do not edit CombatScene.ts until an explicit release.** PR357 owns that file.
[Request6610205358](https://github.com/jaredbahr/Avatarrpg/pull/357#issuecomment-6610205358)
asks only for the existing abilities import and onTap pending-target acceptance
hunks. Camera/overview/glide/HUD and existing tests remain reserved. No silence,
stale claim or alternate helper path grants permission.

If released, use the existing resolveAim for armed ability aim acceptance before
setting pending. Preserve raw move/area/tile/invalid behavior and PR212's
protected-ground/body-picking semantics. No core, content, renderer or art change
is proposed.

## Verification and continuation

The scene regression exercises the actual onTap method on the earned state.
Current focused result: one genuine far-cell failure and 25 passes, comprising
seven new checkpoint/near/move/area/invalid/one-cell controls plus the existing
seven aim and eleven body-pick cases. The original overstrict canonical-message
guard setup failure is retained separately; it was corrected to match the
existing generator's refusal checks.

Root owns the dedicated native baseline, independent review, final exact checks
and any draft publication. Native tests retain actual overlay, real pointer,
preview-state equality, invalid target and actual near confirmation controls on
Canvas/WebGL, with command/event/target/boss identity and AP/damage/log checks.
Do not run full ci:local or push a known-red candidate. After a permitted fix,
require reviewed red→green and exact clean final-head ci:local9/9 before push.

Raw reports, capture PNGs, saves, transcripts and manifests stay outside Git at
`/workspace/avatarrpg-env/aim-discovery/` and
`/workspace/avatarrpg-env/grumbler-aim-414/`. No generated review evidence belongs
in this branch history. WebKit/Safari/PWA, physical input, accelerated performance
and owner visual acceptance remain separate. No merge, deployment, dispatch,
install, paid assistance, new art or security change is authorized here.
