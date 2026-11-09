# Save export/import and damaged-file feedback (#522)

Codex root owns `codex/save-export-import-522` at
`/workspace/avatarrpg-env/save-export-import522/source`, based on main
`94cac3a038ce80d5c17e0cda468a41bbf95d9c62`.
[Claim 6730367905](https://github.com/jaredbahr/Avatarrpg/issues/522#issuecomment-6730367905)
and its source-scope amendment were verified before their respective edits.

The Save menu now presents a plain damaged-file warning instead of exposing a
schema path such as `state.party.0.hp`. The import warning and damaged local-slot
row summary presentation change. Parser diagnostics, validation, lifecycle/version guards,
slots and successful adoption remain unchanged; #413, #504 and #509 files are
read-only. The other additions are `e2e/save-export-import.spec.ts` and this file.
No art, settings, schema, helper, dependency or CI configuration changes.

Eight new cases cover actual visible Export/download and title Load/Import in a
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
all **19** browser cases on that exact CI production build: eight new cases on
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

Related local-slot warning follow-up, 2026-11-09: published PR534 head
`ed4dc2c65edfd0b0b5605990ba1cc62bc70baba2`, tree
`9d19b29a7d77e75846ac73c08d561cde72c720fd`, remains the untouched baseline.
The original revision passed local CI10/10, own-build native17/17 and four
steady-state import checks. Its hosted verification passed; actual E2E/gallery
leaves skipped, so hosted runtime acceptance remains open. These results do not
validate the new follow-up revision.

Root reused that exact CI production build for the external slot-row probe:
**two failures**, desktop 1368×912 and compact 390×844, both only at the expected
plain-warning assertion. The actual row exposed
`This save looks damaged (state.party.0.hp).`; future-format warning, disabled
Load/available Erase, unchanged raw slots on opening Load, and actual valid-slot
adoption with matching state/session passed first. Baseline wrapper 10.803 s;
log SHA256 `756882778274774f284600fb0d5414eba3b477870fb9bc8b18753243b2017be2`.
Original probe source SHA256
`bdd3bae9bfa7da4094814f7071e7ebc2eaee8d4d2911c7fd0c48b30f09706853`;
receipt, JSON/PNG and traces remain under the external evidence directory.

The verified claim amendment extends the same three owned files only. The new
source hunk maps the same known damaged-schema prefix in an errored slot row to
`This save looks damaged. Try another slot or import a save file.`. Import
normalization, parser/raw bytes, future-format warnings, Load eligibility,
Erase and successful adoption stay unchanged. The permanent regression checks
the actual DOM warning before valid loading, excludes `state.party`, preserves
all raw slot bytes, and verifies future and valid controls. It adds one case per
desktop/compact profile; the seven prior cases and three lifecycle controls
retain their original assertions and budgets.

Candidate build passed in 32.321 s; the two permanent slot-row cases passed
in 11.462 s wrapper with no retries. Candidate log SHA256
`fc2e910261f08a1832fc3575f8d22103cd4faa5b578e1a3f2297f9b06c342fa1`.
Independent SOL and root review found no material issue. Root freezes a clean
canonical child of published `ed4dc2c6`, runs full local CI, then all 19 checks
and four steady-state import checks on its own CI production build. Only then
may this SAME PR/branch advance with the expected old remote head. Previous
publication metadata is archived externally; original failures remain intact.
No new PR, rebase, force push, readiness, merge or deployment is allowed.
