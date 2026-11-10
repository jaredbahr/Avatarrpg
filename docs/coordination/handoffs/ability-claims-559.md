# Ability description claims and Fire Step copy (#559)

Owner/session: continuous gameplay-quality goal, root/ability-claims559-20261110.
Branch `codex/ability-description-claims-559`, based on exact main
`30815ebb817a410bae375df3c0f7ebc5473f53ce`, full base tree
`671a37cd2bf25a38edb1bc1b6884c846735ee771`.
[Verified pre-edit claim](https://github.com/jaredbahr/Avatarrpg/issues/559#issuecomment-6763784165).
Live guidance/roadmap/Director comments, current issues, duplicates and all 15
open PR heads/file scopes were refreshed before editing. Matching-head scope
records were reused; no other owner's files or claims were taken.

Exact scope: new `scripts/content/ability-description-claims.ts`, new
`src/content/abilityDescriptions.test.ts`, Fire Step's description only in
`src/content/abilities/fire.ts`, new `e2e/ability-descriptions.spec.ts`, and this
handoff. Root integrates/runs checks; retained SOL High `encounter563_review`
authored the helper/test and audited source read-only; `discipline564_review`
independently reviewed the parser, copy, native fixture and evidence logic.

## Player correction

Fire Step promised any visible tile and guaranteed fire damage/Burning. Real
rules reject an occupied landing and let terrain react before leaving a surface.
The correction says an open tile, qualifies bare-ground fire and possible Burning,
and states that water becomes steam. No ability data, rules, AP, range, duration,
flavor, FX, art, shared UI, renderer or progression changes.

Original reducer probe, supported level-three setup on the authored Forest Road:

- Occupied `(3,4)` is rejected, position `(1,3)`, HP 34 and AP 4 unchanged.
- Bare `(5,3)` is legal: actual move, AP 4→3, HP 34→30, two-round fire and Burning.
- Water `(5,5)` is legal: actual move, AP 4→3, HP stays 34; water→steam, Wet and
  no Burning. The old unconditional promise is therefore false.

The fixture uses `createGame`'s explicit level/choice options and a public
`enterNode` command. It passes official serialize/deserialize and complete
App-order reconciliation without repairs. It is an initialized supported setup,
not naturally earned campaign or encounter-balance evidence. It never rewrites
HP/AP, terrain, unit positions, initiative or runtime content to make a cast work.
An initial diagnostic's nonexistent tile-position property and a blocked draft
bare target were corrected before the actual native test; their originals remain
separate, not reported as game defects.

## Finite content grammar

Every one of the 69 shipped abilities is checked against its own description.
The helper is imported only by tests/review tooling, not the application. It is
a finite explicit grammar, not general natural-language understanding or an
exhaustive validator of unstated mechanics. New constructions need a grammar
example; an unclassified mechanical number fails with its ability id and source
span instead of silently becoming an exemption. No number is required where
copy states none; flavor is outside this audit.

Separate claim categories distinguish authored range from cone/line depth,
blast diameter and push/pull distance; AP cost from grants; cooldown intervals
from at-most-once wording; direct status, cleanse, prerequisite, contact and
conditional reaction; created terrain from existing ingredients; ability sight
from a cloud's sight blocking. Stated chances/durations, explicit base damage,
Wet doubling and ignored Defence are checked where present. Shared/trailing
status durations and conditional surface outcomes keep their named referents.
Lowercase terrain "slow to cross" checks its movement cost, not the Slowed status.
There are no ability-ID suppressions or data edits to accommodate the grammar.

Planted description mismatches exercise each category, unsupported numeric forms,
wrong units, unqualified landing promises, and unrelated "can attack" wording
that must not qualify a terrain guarantee. Positive counterexamples cover the
category boundaries. Existing content tests, assertions, caps and timeouts stay
intact.

## Preserved verification

- First parser-development preflight: 11 failures /97 passes, log SHA256
  `224213ba8b951830c35da6e3e7cf83d455b1512044429306cb65d6fcf90827ae`.
  Its grammar false positives are not claimed as content defects. Root corrected
  bindings and added controls without rewriting other descriptions.
- Refined original-copy baseline: **1 intended failure /114 passes**. Fire Step
  reports both the destination and terrain-guarantee issues. Stable source,
  1.904s wrapper, log
  `ba025d55229da490f4da651bb4cf1b8779cc8cf1e566c69db65474ce541e1aa8`.
- Production-rendered baseline: **4 passed /2 intended copy failures**, 57.893s,
  phone 390×844 and tablet 1194×834, Canvas, no skips/retries. Both full visible
  cards show the original false copy; four real occupied/bare/water control
  cases pass. Exact state/event comparisons, real post-Confirm render frames and
  screenshots are retained. Log
  `e1cc71d9ff63b354ce28b025b1bb72ce2bfe7f596c11b13996a00a5305e0c1e3`.
- Actual rendered baseline producer is retained clean PR573 head
  `f67dade5f3ec80d68e910caf327234312f9bc4e7`, tree
  `c994d112335d64d8fac8389a25ad0328e7aabec5`; its app/renderer/content match main
  at the original copy. Its 353 CI-built dist files remain byte-identical during
  testing. It is not relabeled as the new branch. Setup/native source is bound
  separately in `baseline-native-before.json` and the execution receipt.
- Corrected content: **118 passed**, 83ms tests /1.858s wrapper, log
  `39f56cc757c8d1cfacfb1d85a59bacb4f04ac4e9579ac0e73ab73c3e5c0e8312`.
- Typecheck found a dynamic-union narrowing error in the new displacement
  checker; original failure log
  `d5263476818bc497d5e061e5d28bea98263b5468e711881307f6902b9e5f4e2a`.
  An equivalent explicitly narrowed flatMap fixes it without changing values.
  Typecheck, scoped lint/format and all **118 tests** now pass, 18.687s wrapper,
  log `b0dfbd0ae4fadbfcf3fe949916939e95a8572232027f85f9a60336d008f99506`.
- A separate original/candidate data comparison proves **all fields of all 69
  abilities equal except Fire Step.description**. Stable source, 0.987s wrapper,
  log `1b49a2abdd253d88b507b78560ab50311df90ad32e3245b9647aca386efdaa7d`.

Independent source review is clear, with final type-narrowing recheck recorded
externally. Exact clean-head full `npm run ci:local`, candidate native playback
from that build, canonical publication and actual hosted jobs/skips remain
pending at this source checkpoint. The PR and external receipts record their
exact results/source identities separately. Evidence and every original failure
stay outside Git under `/workspace/avatarrpg-env/ability-claims559/`.

Native observer counters reset immediately before Confirm, so opening frames
cannot count as cast evidence. The observer forwards unchanged real draw/dispatch;
inputs use actual Focus, canvas taps, card and Confirm controls. Paragraph bounds
must fit the viewport and clipping ancestors, with screenshots inspected. Manual
Focus and one bounded pointer pan are disclosed; no automatic-framing, hardware
FPS, physical-input, WebKit/PWA or art/style approval is inferred. No new assets,
clock manipulation, timeout increase, retries, skip or relaxed threshold.

Keep DRAFT. No merge, deployment, dispatch/rerun, install, paid request, art
generation or security/access change. Protected #423/#443/#479 and other owned
work remain separate. No DeepSeek request; approved executor/shared cumulative
ledger remains unverified.
