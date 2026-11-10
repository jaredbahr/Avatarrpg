# Level-10 discipline execution smoke (#564)

Owner: continuous gameplay-quality goal, root/session
`discipline-smoke564-20261110`. Branch `codex/discipline-smoke-564`, based on
`30815ebb817a410bae375df3c0f7ebc5473f53ce`, complete base tree
`671a37cd2bf25a38edb1bc1b6884c846735ee771`.
[Verified pre-edit claim](https://github.com/jaredbahr/Avatarrpg/issues/564#issuecomment-6761643941).

Scope: `src/core/sim/runCombat.ts`, new `disciplineSmoke.test.ts`, and this
handoff. The simulator needs an optional whole-turn party driver to supply the
requested preferred-use policy. Its default AI path, level-setting contract,
round/turn budgets, signatures and diagnostic counters remain unchanged. The
optional driver must return a complete activation's real reducer result and
events. It applies only to the current living party actor; enemies and allies
retain ordinary AI. There are no application/runtime consumers of this helper.

The fixtures keep shared `partyLevel: 10`, with one explicitly selected
discipline/choice slot and default companion builds from `STANDARD_PARTY`.
These are supported maximum-level setups, not earned Act1 progression or
balance evidence. Thirteen legal builds cover ten disciplines and the three
alternative level7 choices without granting mutually exclusive choices together.
Each runs on an early and late board, repeated with fresh policy state.

The test policy prioritizes unseen subject abilities through real movement and
cast commands. Companions can legally end their turns until that coverage is
complete. Only actual subject `abilityUsed` events count. Every technique must
be cast on both selected boards: missing uses always fail, with no exemptions
for targets, death, AP shortage, early victory or policy omission. Real
intermediate logs and all retained events are checked, preserving log caps.

Initial default control: four untouched runs (early/late, diagnostics off/on)
passed with no anomalies, 3.322s wrapper; log
`346778695d2a4abff5e50224356d74457a8c5830eccf49dfa3139d62585402f4`.
Actual control producer is retained clean PR571 head
`1d742017ba31aef266d15e5b8a0e1f1db65811ea`, tree
`5ebe658c37060c464e4f0893a00f504565354ee1`; its simulator/content bytes equal
the claimed main base. Runner SHA256
`4464b2c93e02b536663044a4c8aea956c9aa5254ffb60393cf5ec1346530fda7`.
The complete results/events/counters/signatures, including diagnostics, compare
exactly equal after the optional driver is added: **4/4 identical**, 3.642s,
log `e63705b19cfd2c64c2350514c95586d544216f2080551af92fd0dd85df3a439d`.
Neither control producer is relabeled as a different source.

## Preserved checks

- API-targeted original runner: **3 failed**, because the driver was never
  invoked and unfinished activations were not rejected. The matrix and coverage
  case (27 tests) were CLI-filtered, not run or claimed passed. Stable source,
  3.450s, log `cd5422be78c657dc5cd14a42ee7a2edc036f3b5dac6dce1f6eae25ec0e170372`.
- Optional driver correction: those **3 passed**, 4.201s, log
  `71a39b3ccca6de344be46e997dbbb9c8f0f1fba6a7c558e19946ae9ef41a02dd`.
  Default parity controls compare the full ordinary AI result; the unfinished
  driver control requires an error. Automatic frozen/stunned handoff is not
  restricted to an artificial single `turnStarted` event.
- First complete file: **30 passed**, 25.776s tests, log
  `0623c58bff529a291bd5af44eb0d0dc80f62d2487cc37f7852598a9eaa99f312`.
  It still allowed geometry-backed no-target exemptions. Independent review
  identified a potential occupied-anchor blind spot; this pass is retained
  without claiming strict full use. Root removed the exemption machinery and
  required every selected technique to execute. Aggregate log predicates keep
  exactly the same string/type checks while avoiding repeated matcher overhead.
- Strict file: **30 passed**, 22.870s tests /25.036s wrapper, stable source,
  log `bb6491cb023c617b1ff15ef1b0425e156c64ae2626a2f711f169bf35d0518e7b`.
  Its 26 structured coverage rows show **78 used technique slots per repetition,
  156 over both repetitions, zero missing and no exemptions**. All 52 matrix
  battles complete without anomalies, and fresh policy repetitions match full
  results, events and coverage. Every retained event is independently formatted
  in addition to checking intermediate real logs, including enemy output.

Independent SOL High review/recheck is clear. Simulator SHA256
`dd661b03939b8233dffb5d2f6dc3aa425ae964dacb9786b173a946178e3e7d9c`;
strict preflight test SHA256
`21cd595ba40453b601f97b4d28d6635ee0afe2a56663849f1f10b4bfa0e0455a`.
Root owns simulator integration and all checks; SOL High `encounter563_review`
authored the initial new test, with root's stricter assertion integration;
independent `discipline564_review` reviewed both revisions read-only.

Typecheck then found a readonly-array mismatch in Vitest's `arrayContaining`.
Original failure is retained, log
`8de1bf97d1cc7c90759a0d0b64f79482b178b4275a54aeb52d29891b76076581`.
Passing a copied array preserves every expected element. Full typecheck,
scoped lint and format now pass, 17.315s, log
`cb6f482328e019c36c78f2883c52f4cae4adbddea14efe3ccb3d77b279b0d6aa`.
Final compiled test SHA256:
`3d7c1f5fa153fb4474033fc49acd264c528f4bf3ffe54b204a6281d5ec8ef140`.

Full clean-head `ci:local`, actual under30s **in that CI run**, and publication
remain **not run** at this source checkpoint. The PR and publication receipt
record their exact results and producer identities separately. Hosted test-file
timing is checked independently when that actual job completes. No previous
dirty preflight substitutes for them. Evidence is retained under
`/workspace/avatarrpg-env/discipline-smoke564/`.

Keep DRAFT after exact clean-head CI passes. No gameplay rules, stats, content,
party composition, progression, art, dependencies, budgets or existing test
assertions are changed. No new native/device/campaign acceptance is inferred
from this headless test tooling. Protected #423/#443/#479 and delivered
PR570/571 ownership remain separate. No merge, deployment, dispatch/rerun,
installation, paid request or security/access change. No DeepSeek request;
approved executor/shared cumulative ledger remains unverified.
