# Keyboard continuation after earned level-up rewards — #394

Root, Improve Avatar RPG goal, SOL High implementation and independent
cross-review. Branch `codex/reward-focus-394`, base main
`0d4c2b938f56bd5f8853323b0ea85d13b9a61ff2`.
[Claim verified before edits](https://github.com/jaredbahr/Avatarrpg/issues/394#issuecomment-6569981625).
Scope: LevelUpDialog.ts, new reward-focus.spec.ts/earnedRewardFixture.ts, this
handoff. All26 open/draft PR scopes were inspected; no overlap. DialogueScene
(PR310), Dialog(PR386), DisciplineDialog, App, story/core/progression, styles,
assets and other-owned files remain untouched. Historical PR248's reward load,
checkpoint and pause behavior is preserved.

## Actual reproduction and bounded correction

Reuse the existing quarry trade-route transcript from a fresh game. Stop after
49 legal commands, at ruon_surrender before consuming choices: Kaya/Nilak/Bo
each have250XP/level3 and three earned ability choices after a real forest fight
and Bo's gate diplomacy. No enemy HP, XP, debt, outcomes or state are fabricated.
Serialize that state and import through the real Load/file chooser. Three actual
Learn keyboard activations consume3→2→1→0; each queued reward focuses normally.
On main the final close leaves BODY focused, so Enter does not advance Ruon's
line0. Manually focusing Next then Enter advances line1, errors[]. Root retained
the legal transcript, save, receipt, actual UI probe and rendered stills.

Dispatch replaces the staged control remembered as the dialog's previous focus.
After the existing dispatch and close both return, LevelUpDialog now restores
the live staged Next only when BODY has focus and no dialog remains. Seven added
lines preserve synchronous onDone/reward chaining and any other live focus.
No close-before-dispatch change or generic dialog framework was introduced.

## Validation producers and limits

Clean source/test producer `f5e4b7245ebd374660e78c16735184d85d7be0c6`, complete
tree `e987377618517d0a3ce97143ba9e3c47510d0df1`:

- Original-main runtime baseline: **8/8 fail** specifically at final Next focus,
  exit1/stable124.80s. All per-pick consumption, ability, autosave/full-state/
  session, unchanged story/location/flags and intermediate modal-focus assertions
  passed first. Main dist hashes stayed unchanged throughout the run.
- Candidate production Chromium: **8/8 pass**, exit0/clean/stable48.91s, one
  worker/zero retries, original60s case/10s expectation limits. Enter/Space ×
  Canvas/WebGL ×1368x912 landscape/834x1194 portrait touch profiles at DPR1.
  No existing test, assertion, threshold, timeout or budget was weakened.
- Tests use the actual legal replay, normal serialization and App.adoptSave;
  no Next.focus workaround after the final reward. Each of three keyboard picks
  consumes one choice and checkpoints exact state/session. Intermediate dialogs
  retain focus; no line advances automatically; final Next then advances exactly
  one line using the same activation key.
- Scoped formatting/typecheck/lint/diff passed. Each worker reviewed the other's
  files; root reviewed the combined implementation. No actionable findings.

Raw receipts/reports/traces, legal save/transcript, source reviews and captures
remain under `/workspace/avatarrpg-env/reward-discovery/`. An auxiliary capture
initially treated the public current-scene renderer API's correct null result
on DialogueScene as a failure; its log is retained separately. The actual world
renderer is the retained dialogueBackdrop, read without mutation for capture
provenance. This observation correction changes no product/test/budget.

The final PR records actual exact clean final-head ci:local9/9 and remote tree/
hosted jobs, including actual E2E/gallery skips. Full9 is required before push;
native results do not imply it. Later handoff-only commits preserve the native
src/public/e2e subtrees. API metadata may differ: verify complete tree equality
and attribute local execution to its actual producer, never an unrun remote SHA.

Physical Surface/iPad keyboard/touch, WebKit/Safari/PWA and final visual/motion/
performance acceptance remain open. This does not validate discipline-choice
focus or change that separate entrypoint. No merge, deployment, dispatch,
install, security/credential or art change. DeepSeek runner/shared accounting
remain unverified; no requests. Keep corrections on the same published branch
with its expected head; do not force-push the divergent local graph.
