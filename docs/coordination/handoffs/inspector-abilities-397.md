# Unit inspector techniques — #397

Root, Improve Avatar RPG goal, SOL High implementation and cross-review.
Branch `codex/inspector-abilities-397`, base/main
`0d4c2b938f56bd5f8853323b0ea85d13b9a61ff2`, local
`/workspace/avatarrpg-env/inspector-discovery/source`.
[Claim verified before source edits](https://github.com/jaredbahr/Avatarrpg/issues/397#issuecomment-6572952405).
Only UnitInspector.ts, new inspector-abilities.spec.ts and this handoff change.
All27 open/draft scopes and open/closed topic searches were checked; no overlap
or duplicate. Historical PR207's live refresh/focus contract remains intact.

## Result

The inspector mapped raw unit.abilities and omitted read-time universal Shove.
Root's production-main portrait probe showed only Fire Jab in Kaya's roster
inspector, versus Fire Jab and Shove1AP in the real Forest Road hotbar, errors[].
The inspector now uses existing knownAbilities(content, unit), as the hotbar does.
Card construction, ordering, cooldown details and focus code remain. The rule
adds missing universals for party/allies and leaves enemy authored kits intact.
No core/content/save/scene/Dialog/style/art changes or parallel combat logic.

## Evidence

- Native fixture `0e6cff4f79a14f1ab0637b94e82a056d155d93eb` against the
  original main0d4 production build: **8 genuine missing-Shove failures / 4
  enemy-kit passes**, exit1/stable,320.51s. Every failure reached the inspector
  and expected Fire Jab plus Shove but received only Fire Jab. No setup failures;
  original dist byte hashes remained unchanged.
- Initial candidate0e6cff4f: **11passed/1timed out**, exit1/stable,313.19s.
  Landscape WebGL combat-party hit the original60s whole-case limit. The trace
  shows earlier card/Close checks passing, then final state-read response and
  equality/error checks crossing the deadline. That run remains failed.
- Fixture-only `39293e76f9bbf66e5cb31bc1d65bea34c28d0b2c` batches independent
  original Playwright assertions after the same action/scroll barriers. Every
  count/text/value/visibility/full-state/focus/error check, real control, all12
  cases and original60s/10s/zero-retry limits remain. Other-author review confirmed
  synchronous Close.click remains the state barrier; future async closing needs
  review. No handmade visibility replacement, budget increase or skipped test.
- Fresh exact failed case at39293e76: **1/1passed**,51.709s case,78.17s including
  build, exit0/stable. Then a NEW complete matrix at that same producer/tree
  `c2f6b673a618402cee906dc31955db11f64ef04c`: **12/12passed**,291.47s,
  exit0/clean/stable, zero skipped/flaky/retried cases. The isolate does not green
  the old full run. Actual Canvas/WebGL × landscape1368x912/portrait834x1194,
  installed Chromium, touch-capable DPR1. Full game state remains unchanged;
  real roster, hotbar, turn-strip and projected map controls exercise inspection.
- Separate actual Canvas/WebGL portrait probes show Fire Jab and exactly one
  Shove with its real AP/range/push details, unchanged state, returned roster
  focus and no page errors. Root inspected both rendered stills. Runtime and E2E
  received other-author cross-review and combined root review, without actionable
  findings. Active cooldown/every hero/ally/prelisted-universal saves are not new
  native claims; the existing resolver and unchanged card loop preserve them.

The PR records exact final clean-head ci:local9/9 and publication tree/hosted jobs;
focused/native results do not imply that gate. A handoff-only final commit must
preserve src/public/e2e relative to39293e76. Raw receipts, reports, traces, reviews,
probes, hashes and bundle remain under `/workspace/avatarrpg-env/inspector-discovery/`.
An auxiliary wrong-checkout build log is retained separately and is not accepted
as main/candidate validation; it changed no source.

Keep corrections on the same eventual published draft branch with expected head;
never force-push divergent API metadata graphs. Physical Surface/iPad input,
WebKit/Safari, PWA and final visual/performance acceptance remain open. No merge,
deployment, dispatch, install, purchase, security/credential or art change.
DeepSeek executor/shared ledger remain unverified; no requests.
