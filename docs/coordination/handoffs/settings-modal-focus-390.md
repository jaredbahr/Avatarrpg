# Settings keeps keyboard focus above conversations — #390

Owner: root, Improve Avatar RPG goal, SOL High implementation and independent
review. Branch `codex/settings-modal-focus-390`, base main
`0d4c2b938f56bd5f8853323b0ea85d13b9a61ff2`.
[Claim verified before edits](https://github.com/jaredbahr/Avatarrpg/issues/390#issuecomment-6567968182).

Scope: SettingsPanel.ts, new settings-modal-focus.spec.ts, this handoff. Live
open/draft PR file scopes excluded these files. ExploreScene, Dialog, App,
styles, story, rules, assets and other-owned files remain unchanged. Historical
PR207's intentional settings-refresh heading focus is preserved; PR386 owns
the separate nested-Escape correction and is not duplicated here.

## Reproduction and correction

During Mira's Ba Dan conversation, open Pause then Settings, toggle Show grid,
and press Enter. Root reproduced actual production main moving focus from the
Settings heading to background Next, then advancing mira_intro line0 to line1
while Paused and Settings remained open, with no page errors.

Applying settings synchronously syncs the scene, which can focus its rebuilt
conversation before Dialog.refresh checks focus location. SettingsPanel now
reasserts its usual heading focus after its own toggle/radio refresh. No shared
dialog, scene lifecycle or story behavior was changed.

## Evidence and limits

Clean source/test producer `ef9737b768e0bb0163a27d19c93d42c18ef2d05a`, complete
tree `522e6c089649d56c00d87e3758196aa1ab5f6da4`:

- Unchanged-main production baseline: all eight new cases failed at Settings
  heading focus, exit1, stable fixture/harness, 208.89 seconds. The main build
  was made before source edits and its dist hash manifest stayed unchanged
  throughout the baseline run. Root's separate keyboard probe establishes the
  resulting actual dialogue advance; the regression stops at lost focus.
- Candidate: all eight cases passed, exit0, clean/stable source/tree/harness,
  262.95 seconds, one worker and zero retries. Canvas and forced WebGL, both
  1368x912 landscape and 834x1194 portrait touch profiles at DPR1, installed
  Chromium. Original default60-second case and10-second expectation limits
  were retained; no assertions, budgets or retries weakened.
- Both switches and radio choices are covered. Show grid's value/ARIA state
  changes; Largest changes its value/ARIA state and computed root font size.
  Enter and Space separately preserve the complete game state; Tab/Shift-Tab
  stay in Settings. Done/Resume then allow real keyboard Next and Sit down
  activation, so globally disabling conversation cannot satisfy these tests.
- Scoped formatting, typecheck, lint and diff checks passed. Independent SOL
  source review found no actionable defect. Existing tests were untouched.

Raw receipts, reports, traces, dist hashes, source review and actual rendered
probes remain under `/workspace/avatarrpg-env/discovery-next/`; the final PR
records exact clean final-head ci:local results and publication identity. Later
handoff-only commits preserve this producer's src/public/e2e subtrees. Full
ci:local9/9 is required before any publication; native passes do not imply it.

Controlled local Chromium keyboard/touch profiles do not establish physical
Surface/iPad input, WebKit/Safari, PWA acceptance, or final visual/style/performance
approval. Those gates remain open. Report actual hosted E2E/gallery skips
separately from aggregate checks. No merge, deployment, dispatch, install,
credentials/security, art or schema change. DeepSeek executor/shared ledger
remain unverified; no requests were made.

Keep corrections on the same published PR branch with its expected remote head.
If API publication changes commit metadata, verify complete tree equality and
attribute local test execution to its actual local producer; do not force-push
the divergent local graph. The goal queue and intake handoff retain the next
assignment and older local candidates, including #383's pending shared-file
handoff. Do not take those files over without explicit coordination.
