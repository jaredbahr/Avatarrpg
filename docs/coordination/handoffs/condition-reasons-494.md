# Condition-description contracts (#494)

- **Owner/location:** Codex continuous gameplay session
  `condition-reasons494-20261108`, root integration owner; branch
  `codex/condition-reasons-494` from `1c273d2a004456679d3cdb5949773b5e864eaeff`.
  [Verified claim](https://github.com/jaredbahr/Avatarrpg/issues/494#issuecomment-6719807785).
  The eventual draft PR records the exact tested commit/tree and check results.
- **Outcome:** condition descriptions use existing resident display names,
  preserve mixed conjunction/alternative grouping, and form complete clauses
  under the conversation panel's existing “Only if …” framing. Generic negation
  remains explicit about its entire operand.
- **Boundary:** preserve evaluation, depth limits, standing storage, authored
  `lockedHint`, story facts, rules, content, art and character identity. Current
  gated story options have authored hints; these are description-contract fixes,
  not a claim that these broken fallbacks are currently painted on those routes.
- **Coverage:** typed fixtures cover every `Condition['kind']`; recursively
  collect actual content conditions and nested children with provenance. Cover
  canonical resident names, clean text, grouping, phase clauses, generated
  `not(any(...))` and conjunctions of three or more requirements. Disciplines use
  `requiresFlag`, not direct `Condition`; report any adapter coverage distinctly.
- **Ownership:** root owns the description section of `conditions.ts` and this
  handoff; SOL High Standard owns the new description test and only the relevant
  existing description expectations. Own draft #507 changes only the readonly
  export of `NATION_WORD`; this main-based branch leaves that declaration and
  its label values unchanged. Both changes share one root integration owner.
  PR #310 owns the caller files; `DialogueScene.ts` and `ConversationPanel.ts`
  remain read-only here.
- **Acceptance/evidence:** retain baseline failures, run focused and static
  checks, source review and exact clean final-head `npm run ci:local` before
  branch publication. Relevant production-browser checks exercise the real
  conversation component with labelled fallback fixtures, actual rendered text,
  disabled controls and authored-hint/restored-option positive controls. Fixture
  conditions are not evidence of an authored reachable story branch. Source,
  build and probe identities are retained with reports and screenshots under
  `/workspace/avatarrpg-env/condition-reasons494/`.
  The revised original-production baseline retained 105 failures and 273 passes;
  corrected focused checks passed all 378 tests (335 new, all 43 existing).
  Coverage retains 310 actual condition occurrences: story 115, maps 94,
  encounters 2 and residents 99. Disciplines contribute no direct conditions;
  their flag adapters are reported separately. Typecheck, scoped ESLint and
  formatting passed, and root/SOL source review found no blocking concern.
  Final-head CI and rendered results remain pending until recorded in the PR.
- **Remaining gates:** report actual results, failures and hosted skips in the
  PR after checks run. Browser emulation does not establish physical Surface or
  iPad input, WebKit, hardware performance, audio listening or Home Screen/PWA
  acceptance. No source or renderer threshold may be weakened to close a gate.
- **Storage:** completed owned #423 derived caches were consolidated against
  identical retained files under a separately verified claim, preserving every
  path, byte and file mode/ownership. Shared copies are frozen; detach before
  future writes. New mutable source files are independent copies.
- **Delivery/resume:** draft only; no merge, deployment, workflow dispatch,
  installation, asset generation or security/credential change. Check live
  claim/head/jobs before resuming. Corrections remain on the same draft branch
  and require fresh final-head evidence. The PR is authoritative for completed
  verification; this handoff does not predeclare pending checks passed.
