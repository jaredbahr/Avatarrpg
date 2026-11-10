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

## Hosted timing correction on the same draft

Original published head `fc11604ca1493b30bcf710ac0ea901c93d8d1a63`, tree
`0c072a35520647468f38f171209069c20b238797`, passed all 12 local CI stages,
315 files /4,089 tests. Its smoke file took 24.131s locally, but **35.207s**
in actual hosted verify job `129708400013`, run `42780285916`. The unchanged
**under 30s** acceptance therefore failed despite the green job. Actual E2E
`129712727498` and gallery `129712774277` were skipped. Original hosted log,
source and job identities remain in `hosted-original.*` and
`smoke-hosted-failure-source.test.txt`; no hosted rerun was dispatched.

Lazy movement searches and fresh-policy target caching preserved all 26
complete battle result/coverage rows exactly against the published policy, but
did not yield a useful speed gain. Both 30-test comparison probes and the
initial probe's output-label ReferenceError are retained separately. A Node CPU
profile then attributed about 19.4s to ordinary full-kit party AI after technique
coverage. The matrix's purpose is legal technique execution, not repeated AI
forecasting; the companion **builds** remain their defaults.

After every preferred technique has actually executed, the test now finishes
with each character's equipped level-1 attack, using real legal targets,
current AP, reachable paths and affordable prefixes through the reducer.
Finishing casts and movement must emit their actual events and consume their
respective resource while the same activation continues; refusal or no progress
throws immediately. Enemy/ally AI, the separate full-result default-AI parity
controls and the simulator's production helper are unchanged. This finishing
policy changes command sequences, so the earlier exact old/new result identity
is claimed only for the geometry optimization, not the final policy.

All **52** matrix battles, **13** builds, **33** distinct techniques, **156**
actual repeated technique uses, both fresh repetitions, whole-result equality,
intermediate logs, retained event formatting, anomaly/outcome assertions and
original caps remain required. No technique exemptions, skipped cases, raised
timeouts, budget changes, state fabrication or runtime AI edit were introduced.

The basic finishing policy passed all **30 tests in 7.340s** (9.422s wrapper),
log `89ef5e87bca9559b1ccc236031a4f928538718def45f6c49d5c5b5abc688a8d9`.
The refusal/progress hardening followed independent review; typecheck and
scoped lint/format passed in 17.636s. Exact corrected clean-head full CI and
actual hosted timing are still pending at this source checkpoint; the PR and
external receipts record their exact identities separately. No previous dirty
preflight substitutes for them. Evidence remains under
`/workspace/avatarrpg-env/discipline-smoke564/`.

Keep DRAFT after exact clean-head CI passes. No gameplay rules, stats, content,
party composition, progression, art, dependencies, budgets or existing test
assertions are changed. No new native/device/campaign acceptance is inferred
from this headless test tooling. Protected #423/#443/#479 and delivered
PR570/571 ownership remain separate. No merge, deployment, dispatch/rerun,
installation, paid request or security/access change. No DeepSeek request;
approved executor/shared cumulative ledger remains unverified.
