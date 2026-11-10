# Avoid stationary pure-dash AI actions (#582)

Owner: continuous gameplay quality, `root/ai-dash582-20261110`.
Branch: `codex/ai-dash-582`, based on main `a76ce28c`.
[Verified pre-edit claim](https://github.com/jaredbahr/Avatarrpg/issues/582#issuecomment-6771257895).

## Finding and boundary

The retained #520 Forest Road witness, numeric seed 899863172 with the authored
solo party, starts enemy e5 at (17,5) with 4 AP. Its first public AI activation
uses Rush at that same position, spending 2 AP and starting its cooldown before
walking. The dash is a zero-cost move with no displacement. The scorer gave
this purpose-free pure dash positive value.

Reject own-position aims only when the ability has nonempty, entirely dash
effects. Check both the supplied caster pose and that unit's actual current
draft pose, so a move-first preview cannot value a walk out followed by Rush
back to its origin. This is the current planning iteration's pose, not a frozen
whole-turn start. Preserve
mixed abilities that intentionally apply another effect at their own position.
No candidate ordering, weights, ability execution, content, roster, balance,
progression, renderer or asset change belongs here.

The original four-file scope is `ai.ts`, new `aiDash.test.ts`, new
`e2e/ai-dash.spec.ts` and this handoff. A verified amendment adds only derived
hash/count literals in `scripts/e2e/quarry-checkpoints.test.ts` and
`src/app/scenes/combatAim.test.ts`; all functional assertions remain unchanged. Root owns integration, native validation
and the handoff; the retained SOL High author owns the AI and unit-test files.
The independent reviewer owns no writes. PR580/581 presentation ownership and
the protected #423/#443/#479 browser route remain separate.

## Evidence and acceptance

Evidence is retained at `/workspace/avatarrpg-env/ai-dash582/`.

- Before any AI edit, the five targeted unit tests produced two failures and
  three passes. Own-pose scoring and the authored public activation failed;
  useful moving Rush, occupied/blocked landing and compound dash/buff controls
  passed. `unit-red.*` preserves the failure and source identity.
- The first own-pose guard passed the initial five tests and 93 related AI
  tests, but an additional exact-witness trace proved a remaining roundtrip:
  walk (17,5) to (13,7), then Rush back, final AP0 and no net progress.
  `first-activation.*` preserves that insufficiency. The unit assertions were
  strengthened to require final-state net displacement and reject an aim at
  the actual draft origin from a hypothetical pose; they failed twice against
  the first guard (`unit-roundtrip-red.*`). No original assertion was relaxed.
  The final narrow guard also rejects this draft-origin aim. Compound effects,
  real Rush, legal collision rejection, handoff and input purity remain required.
- The final rendered baseline produced two failures and two passes on actual
  Canvas and WebGL: both authored activations failed on the same stationary
  Rush; both useful-Rush/collision controls passed. No skips, retries or flaky
  results. `native-baseline-final.*` binds the unchanged production build.
- Native probes forward the actual renderer draw unchanged, observe its
  rendered positions and keep motion enabled. They distinguish dash displacement
  from walking path costs. The direct Rush segment is isolated geometrically:
  another AI command can queue before its animation finishes. Public Pause is
  used only to let the renderer initialize before the observed activation.
- Earlier local harness/setup failures are preserved in their own receipts.
  Corrections used the existing module/FFmpeg paths and the real combat draw
  contract. They did not install software, change production code, increase
  timeouts or weaken gameplay assertions. No gameplay pass is inferred from
  those failed probe attempts.

The amended guard passes all 93 related AI tests plus typecheck, lint and
scoped formatting (34.974 s, stable). Its exact authored trace now walks from
(17,5) to (13,7) without using Rush or starting its cooldown. Final AP0 is the
normal end-turn reset; it is not evidence that Rush spent four AP. Native
candidate and full-CI results must still be recorded separately in the PR.

Before publication, require the relevant AI regression suite, static checks,
independent source/evidence review, an exact clean final-head `npm run ci:local`
pass and all four native candidate cases. Record exact commit/tree, producer,
passed/failed checks and actual hosted jobs/skips in the draft PR and receipts.
Watch the rendered movement and inspect its collision/camera evidence. Node
tests and software Chromium do not establish device FPS, WebKit, physical
input or PWA acceptance. Do not change budgets or assertions to obtain green.

## Derived checkpoint pins

The first clean-head full CI (`00c43e07`) stopped on five existing derived pins.
The identical two test files pass all 20 cases on exact unchanged parent main.
Before changing references, root generated both routes and the aim checkpoint
_twice_ on parent and candidate and replayed every public command. Helpers are
byte-identical. All four complete route-boundary projections and sessions match;
all progression, custody, returnee, world, clock and load assertions remain.

The exact first divergent state is the same enemy command with the same input
hash: the old history uses a stationary Rush, the repaired one advances. The
new exact command counts are 61/157 for trade and 92/429 for escort. The earned
aim has 78 commands instead of 79. Its round, caster position/AP, full boss,
far/near geometry and legal targeting premise remain unchanged. The caster's
current HP changes from 24 to 25 as combat history; no existing assertion
requires HP24, and no base stat or meaningful HP expectation is changed.
Do not describe the complete aim state or all participant health as identical.

The owner's explicit split moved aiming out of PR357 into merged PR556;
merged PR570 subsequently refreshed these same references under verified scope.
PR362/344's active six-file scope is media/docs. Root verified these records
before the six-file amendment, not by taking stale claims or inferring release.
The old pins, failed CI, full forensic reports and unapplied proposal remain
in the parent folder. Only strict hashes/counts are refreshed; no assertion,
fixture producer, seed, route, cap or gameplay premise is weakened.

## Separate statistical guard

#520's original four small-sample and two full-sweep failures remain preserved.
Its changed-condition reassessment passed twelve deterministic/parity controls
and ran only three retained witnesses, not a statistical acceptance matrix.
That work discovered this actual bug; it did not establish AI superiority.
The unshipped guard remains unpublished on its own branch, with writes released.
This fix changes no statistical margin, endpoint, seed, sample count or cap.

Keep the eventual PR DRAFT. Corrections use that same published branch with its
verified remote head. No Ready, merge, deployment, dispatch/rerun, installation,
paid request, generated/replacement art or security/access change is authorized.

## Native startup correction

Clean head `99ba2fd7` passed all 12 local CI steps (328 files, 4,411 tests).
Its first native candidate run passed three cases and failed the WebGL useful
Rush animation control: only one distinct busy frame was drawn during the
unchanged one-tile dash. Resource/collision/event checks and both authored
net-progress cases passed. The failed receipt, observer, trace and video remain
preserved; it is not reported as four passing cases.

A facade draw can queue a pending view before Pixi finishes initialization.
The setup now keeps public Pause through curtain completion, the existing
layout-settling check, a paused canvas screenshot and two further idle draws.
Full game state (including RNG) must remain identical and no observed AI or
ability command may run during warmup. This is bounded scene warmup, not a
promise that every asset has loaded. The one-tile target, all gameplay and
strict motion assertions, speed, clocks and timeouts remain unchanged. A new
clean full CI and all four native cases are required on the corrected head.
