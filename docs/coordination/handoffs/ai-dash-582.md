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

The exact four-file scope is `ai.ts`, new `aiDash.test.ts`, new
`e2e/ai-dash.spec.ts` and this handoff. Root owns integration, native validation
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
