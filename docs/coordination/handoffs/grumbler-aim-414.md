# Highlighted Grumbler target cells (#414)

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
