# Save export/import and damaged-file feedback (#522)

Codex root owns `codex/save-export-import-522` at
`/workspace/avatarrpg-env/save-export-import522/source`, based on main
`94cac3a038ce80d5c17e0cda468a41bbf95d9c62`.
[Claim 6730367905](https://github.com/jaredbahr/Avatarrpg/issues/522#issuecomment-6730367905)
and its source-scope amendment were verified before their respective edits.

The Save menu now presents a plain damaged-file warning instead of exposing a
schema path such as `state.party.0.hp`. Only `SaveMenu.importSave()` warning
presentation changes. Parser diagnostics, validation, lifecycle/version guards,
slots and successful adoption remain unchanged; #413, #504 and #509 files are
read-only. The other additions are `e2e/save-export-import.spec.ts` and this file.
No art, settings, schema, helper, dependency or CI configuration changes.

Seven new cases cover actual visible Export/download and title Load/Import in a
new browser context with empty storage: exploration after a real pointer walk,
and a battle after actual legal damage/status activity. Full state/session and
a following RNG-consuming action's events and state must match. Empty,
truncated actual export, shipped PNG, nested malformed state and future-format
files must warn freshly, keep Load open, and preserve the game/session and all
four populated raw slots. Nothing mocks browser file I/O or save adoption.
Public helpers skip unrelated setup. Battle setup selects legal commands with
the pure rules and dispatches them through the running App; storage fixtures
use its real slot writer. Those steps are not physical-input acceptance.

Evidence is retained under `/workspace/avatarrpg-env/save-export-import522/`:

- Untouched main production: **2 passed, 1 failed**; actual warning was
  `This save looks damaged (state.party.0.hp).`. Root reviewed the captured
  warning. Original test source, JSON, PNG, trace and receipt are retained;
  baseline log SHA256 `511c1acd4165d6091373561fc82147d9023f6f796bd88a2d186af02838b6954a`.
- Candidate build passed in 29.877 s. Initial browser matrix: **11 passed,
  6 failed**, all failures before import because the new fixture clicked
  x=707 on a 390-pixel screen. This was a harness defect. The fixture now
  requires a visible, topmost canvas target, records its geometry, performs a
  real click and retains exact destination/changed-location assertions. Desktop
  keeps the four-tile walk; compact uses its visible one-tile neighbour.
  Original failures remain; no assertion or timeout was weakened.
- Repaired compact cases: **6/6 passed**, 16.6 s (18.367 s wrapper),
  log SHA256 `cb506df6cce73febdc4ab9720e61305fb67dfc05e23bab1b1509e3f905b04dad`.
  Independent SOL and root review found no remaining material issue.

Root freezes the final clean head before required `npm run ci:local`, then runs
all **17** browser cases on that exact CI production build: seven new cases on
desktop and compact touch profiles plus three unchanged save-import lifecycle
checks. The PR and same claim record final head/tree, receipts, rendered capture
review and actual hosted leaf jobs/skips. The original 60 s test and 10 s expect
budgets remain. Local rendered Chromium does not establish physical-device,
WebKit, PWA or hardware-performance acceptance; service workers are blocked in
these isolated file-I/O cases. Hosted E2E acceptance remains open if its leaf
jobs are skipped; no dispatch is authorized.

Publish as DRAFT only after those gates pass. No merge, Ready, deployment,
installation, art generation/replacement, security or credential change.
DeepSeek runner/shared accounting is unverified: no requests. Corrections stay
on this task's branch; preserve all failures and evidence at handoff.
