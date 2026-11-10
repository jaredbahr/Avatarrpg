# Discipline reward keyboard focus (#551)

Owner: continuous playable-quality goal, root/session
`discipline-focus551-20261109`. Branch `codex/discipline-focus-551`, based on
`d6c5ffce5af928d7999c700bc60896adf33b28e3`. Pre-edit claim and milestones:
[#551 comment 6743869637](https://github.com/jaredbahr/Avatarrpg/issues/551#issuecomment-6743869637).

Completing the final discipline choice rebuilt the dialogue's original focus
target, then closed the modal onto that detached control. Focus fell to BODY;
Enter/Space stopped continuing the conversation. The existing technique-reward
fix (#394/PR395) explicitly left DisciplineDialog outside its scope.

DisciplineDialog now uses that established post-close guard: restore the live
dialogue Next or, when there is no Next, the first enabled response option, only
when BODY is focused and no dialog remains. Focusing never selects a response.
Dispatch, close,
the synchronous next-reward callback and autosave order stay unchanged. The next
reward's heading or any other live focused control keeps focus. No shared Dialog,
App, DialogueScene, renderer, styles, progression, content, assets or save code
changed.

The sixteen-case Canvas regression covers single/chained discipline choices,
Enter/Space and retained-world/plain narration and response panels. Each real keyboard pick is compared
with the complete reducer result, exact session and real autosave. The test checks
the discipline/kit, pending queue, intermediate modal heading, unchanged story,
location and flags, final live Next/response focus, and exactly one advance or
response selection on the next key. Response cases compare the complete resulting
state, decider, flags and autosave after that separate key. All eight original
narration test-loop bytes remain identical. No authored first-disabled response
exists in current content; the selector excludes disabled options, but no runtime
case for that exclusion is claimed.
Captures are written to the external Playwright output, never committed.

These are explicit supported level-5 save fixtures, not earned level-5 campaigns.
Retained-world fixtures replay the existing earned Ruon checkpoint, consume its
real technique rewards, and, for responses, advance his actual lines to
`ruon_choice` before adding fixture XP through `awardXp`. Plain fixtures use
canonical level-5/700-XP members. Existing reconciliation supplies discipline debt;
the current main serializer validates both before browser adoption. No gameplay
progression, roster or story rule is changed to make the fixtures possible.

Preserved validation before the final publication commit:

- All eight new cases failed on the unchanged old production UI at the intended
  final `Next.toBeFocused()` assertion; discipline/state/session/autosave and
  intermediate modal checks had passed. No skips/retries; 108.000s wrapper.
  Log SHA256 `8a6ada43f7e469e8ade84145794904edaa7b4a334ec81e1d220d5d0d80093329`.
  Producer `f903712e79bad7c42e10e975191b7c7de581ae34`, complete tree
  `00431213a8b3bc8b414d450b58c03efd98708224`; its relevant UI equals the current
  base. All 353 build files stayed identical, manifest
  `af4869dcf7cad10e440c5fb4ce741711aa1b456219385c9b3c54bb95b2c9d068`.
  The test runner uses current-main fixtures; old runtime save-validation coverage
  is not inferred from this counterfactual producer.
- Typecheck, scoped lint and formatting passed. The preliminary candidate build
  passed; its tablet Canvas run passed all eight cases plus the two unchanged
  technique-reward keyboard controls: 10/10, zero skips/retries/flaky results,
  20.641s wrapper. Log
  `f4bb61e71f937dfe0893b020aa53dde721167d238d4634266be6f16563815f77`.
  This preliminary run qualified the earlier narration source only.
- Published narration head `2e27edf13c3da4dc2705082bf0cb8846a2a00814` passed
  clean CI11/11 (307 files / 3,991 tests) and its own-build phone/tablet20/20.
  Its actual hosted verification passed; E2E/gallery leaves were skipped. That
  source, build and evidence remain under `published-2e27/`, with their original
  identities. A later supported save at `ruon_choice` exposed the same focus
  loss because this head queried only Next. The response correction continues
  on the SAME branch/PR; earlier passes are not relabelled as its qualification.
- All eight added response cases failed on that preserved published CI build at
  the intended response-focus assertion, after all prior discipline/state/session/
  autosave/intermediate-modal checks passed. No skips/retries; 108.343s wrapper,
  log `17e149abcaa7d0ea17858a919c89e6d4c46dd6752cc201fcab1e34d8b07d15eb`.
  All353 producer files stayed unchanged; manifest
  `6a3a3b02521e9a03d2bc35b203992f4ff66ccd692616cbbc77254e388001567d`.
- Corrected preliminary build passed; expanded tablet Canvas18/18 passed in
  34.853s wrapper (16 discipline cases plus two unchanged technique controls),
  log `a1cbe2f051fc43f1250d8337d9612c16708870752b04835e78272ce53d608d39`.
  This is dirty-source preliminary evidence. Final exact-head CI and own-CI-build
  phone/tablet36-case evidence are recorded separately in the PR and receipt.
- Independent SOL High source/evidence review found no blocker. Root reviewed
  the production hunk, spec and representative preliminary captures.

Discovery retained a separate initial harness error: a staged-only selector was
used on the plain fallback and timed out. Its source/log/PNG remain; its trace
was overwritten by the corrected probe, so initial-trace retention is not claimed.
The corrected probe recorded BODY focus, Enter leaving line 0, and manually
focusing the real Next allowing Enter to reach line 1. The full eight-case failure
reports, traces and captures are preserved independently.

Evidence root: `/workspace/avatarrpg-env/discipline-focus551/`, including
`discovery-baseline/`, `baseline-native.receipt.json`, `baseline-report.json`,
`baseline-results/`, producer manifests, focused/preliminary receipts,
`independent-review.json`, and final exact-head CI/native/publication receipts.
The PR description and same claim bind final results to the published head/tree.

Keep the delivery DRAFT. Physical keyboard/input and devices, WebKit/Safari/PWA,
hardware performance and broad visual acceptance remain unverified. Canvas checks
exercise the actual DOM dialogue/reward flow; no renderer contract changed.
Corrections remain on this branch/PR with fresh exact-head gates. No merge,
deployment, hosted dispatch/rerun, installation, asset generation, access/security
change or DeepSeek request is authorized here. #423/#443's existing owner and
retained-candidate workflow remain separate; #547's shared-file handoff is pending.
