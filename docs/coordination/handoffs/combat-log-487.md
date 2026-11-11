# Combat-log formatting coverage (#487)

- **Owner/location:** Codex continuous gameplay session `combat-log487-20261108`,
  integration owner `/root`; branch `codex/combat-log-487` from
  `1c273d2a004456679d3cdb5949773b5e864eaeff`. Claim:
  <https://github.com/jaredbahr/Avatarrpg/issues/487#issuecomment-6718941889>.
  The draft PR records the exact tested/published commit, tree and check results.
- **Outcome:** cover every `GameEvent['type']` with a matching typed fixture and
  check events from twenty complete seeded battles against actual roster names.
  Correct standing-change formatter output to use the existing nation names
  rather than element technique names such as “Firebending.”
- **Behavior boundary:** `reducer.withLog` currently filters standing changes.
  This is a formatter contract correction, not a newly displayed story log.
  Preserve that filter, intentionally silent event kinds, simulator behavior,
  authored content, rules, progression, art and character identity.
- **Implementation:** `log.ts` reuses the existing `NATION_WORD` mapping through
  a readonly export from `conditions.ts`. Tests own exhaustive fixtures, content
  name checks and a forwarding observer around the existing simulator's real
  reducer calls; they do not substitute a simulator or invent roster names.
- **Acceptance:** retain the original nation-name failures before the fix; pass
  focused coverage, typecheck, lint, formatting and exact clean final-head
  `npm run ci:local` before branch publication. A complete battle must reach
  victory or defeat without anomalies or a stalemate. Native production-browser
  checks exercise a real Rock Throw, confirmation and visible combat log with
  normal motion, reusing the existing face-off fixture and preview assertions.
- **Evidence:** `/workspace/avatarrpg-env/combat-log487/` retains source manifests,
  original failures, command logs/receipts and native captures. The PR reports
  actual passed/failed/skipped checks. Headless tests do not establish rendered
  acceptance; Chromium emulation does not establish physical Surface/iPad input,
  WebKit, hardware performance, audio listening or Home Screen/PWA acceptance.
  Before publication, the original formatter failed eleven revised nation-name
  checks while thirty-six controls passed; the corrected source passed all
  ninety-one focused tests across log, obscurement and conditions. The twenty
  battles emitted 7,458 events (5,776 visible and 1,682 intentionally silent).
  Typecheck, scoped lint and formatting passed; root and SOL source review found
  no blocking concern. Final-head CI and native results belong in the PR once
  actually run, including any failures or skips.
- **Coordination:** root owns `log.ts`, the readonly mapping export and this
  handoff; SOL High Standard owns only new `log.test.ts`. Other owners' files and
  PRs remain untouched. Ignored duplicate caches/build outputs in completed owned
  worktrees were consolidated with per-file identity verification; all paths and
  bytes remain, and shared copies must be detached before future writes.
- **Delivery:** draft only. No merge, deployment, workflow dispatch, installation,
  asset generation or security/credential changes. Corrections stay on the same
  PR and require fresh exact-head checks. Verify live claims/head/jobs before
  resuming; the PR, rather than this pre-publication handoff, is authoritative for
  completed evidence and remaining gates.
