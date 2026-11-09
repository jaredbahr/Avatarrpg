# Technique rewards return to response choices (#553)

Owner: continuous playable-quality goal, root/session
`reward-response553-20261109`. Branch `codex/reward-response-553`, based on
`d6c5ffce5af928d7999c700bc60896adf33b28e3`.
[Pre-edit claim and milestones](https://github.com/jaredbahr/Avatarrpg/issues/553#issuecomment-6747863152).

Loading a response-choice save with outstanding technique rewards consumed the
rewards correctly but left focus on BODY after the final Learn. Enter/Space then
did nothing until a real response was focused. #394/PR395 restored narration's
Next; #551/PR552 covers the separate discipline entrypoint and explicitly leaves
LevelUpDialog unchanged.

LevelUpDialog keeps its post-dispatch/close BODY/no-dialog guard and Next priority,
adding the first enabled response only when Next is absent. It does not activate
a response, reorder rewards/autosaves or take focus from a queued modal or another
live control. The exact scope is LevelUpDialog, one new dedicated E2E spec and this
handoff. Shared App/Dialog/DialogueScene/ConversationPanel, DisciplineDialog,
earnedRewardFixture/reward-focus tests, rules, progression, saves, styles,
renderer, content and assets remain unchanged. Other open PR scopes and duplicate
issues were checked before the claim; no ownership was taken from another task.

The fixture reuses the existing 49-command earned quarry replay: Kaya/Nilak/Bo
each have level3/250XP and three earned ability choices. It applies the actual
Ruon dialogue commands to stage a supported save cursor at `ruon_choice`, keeping
the earned rewards outstanding. This does **not** claim the live App lets a player
bypass its mandatory modal. No XP, HP, party, outcome, flag or debt is fabricated.
The single-reward case consumes the first two earned techniques through normal
core commands before browser adoption. Normal serialization validates both saves.

Four response cases cover single/chained rewards and Enter/Space. Every actual
Learn compares the complete reducer result, session, learned ability/pending queue
and real autosave, with unchanged story/location/flags and intermediate heading
focus. After the final modal, the first enabled real response must be focused and
still unselected. A separate next key chooses exactly one option; the complete
result, decider, flags and autosave must match the reducer. Existing narration
reward controls run unchanged alongside these cases. Captures stay in external
Playwright output, never in Git.

Preserved evidence before final publication qualification:

- Discovery on clean producer `81814b59fb036226e6f80c274f0df43c288c0222`, complete
  tree `f0c46ababad61ae26d3257a83243c41454611ab1`: successful three-reward
  adoption, BODY focus, Enter leaving `ruon_choice`, then manually focused real
  response selecting `escort_chosen`. One intended failure, 7.937s wrapper, log
  `30a15dd8699b707a93306158f110ed38916b03471e318967f446224b9949fbe5`.
- All four new regressions failed on that unchanged own-CI production build at
  final `response.toBeFocused()`, after the preceding state/session/autosave/
  reward/intermediate-modal checks passed. No skips/retries; 57.020s wrapper,
  log `4eed6f00eff0b350faf44884687b6b273ba8d45566bd0df5665d126b04c2b563`.
  All353 build files stayed unchanged; manifest
  `41196b5acb4ea8f6fdffbbe346f2ec806531e31652163b51dfb195248b5061e4`.
  This producer includes unrelated discipline changes but the relevant technique,
  shared dialogue/dialog and core/save sources equal current main. Test-source
  and runtime-producer identities are kept separate.
- Formatting/scoped lint and independent SOL High source/evidence review passed.
  Root reviewed the source and test; the test author separately reviewed the fix.
- Preliminary candidate build passed. Its tablet Canvas6/6 passed (four response
  cases plus two untouched narration controls), no skips/retries/flaky results,
  13.441s wrapper, log
  `99e736bd8aa75927ee40d7c5083b742b26469d6f2789d454d25bae2026ac7524`.
  This is dirty-source preliminary evidence, not final-head qualification.

Final exact clean-head `npm run ci:local`, own-CI-build phone390x844/tablet1194x834
Canvas12-case controls, source/build stability, root rendered review and remote
head/tree/blob verification are recorded separately in the PR and publication
receipt. Keep DRAFT and distinguish actual hosted jobs from skipped runtime leaves.
Physical keyboard/input/devices, WebKit/Safari/PWA, hardware performance and broad
visual acceptance remain open. Disabled responses are excluded by the selector;
there is no authored first-disabled example and no invented runtime coverage.

Evidence: `/workspace/avatarrpg-env/reward-response553/`, including final CI/native
receipts, reports/results, manifests, independent review, frozen source and
publication receipt. Discovery remains in sibling `reward-response-discovery/`;
original reports/traces/captures are preserved. Corrections stay on the same task
branch/PR with expected-head verification and fresh gates. No force push, merge,
deployment, hosted dispatch/rerun, installation, security/access/credential or art
change. DeepSeek executor/shared cumulative ledger remains unverified; no request.
Protected #423/#443 ownership and retained-candidate workflow remain separate;
#547's explicit shared-file handoff is still pending.
