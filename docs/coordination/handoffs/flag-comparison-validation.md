# Numeric flag-comparison operand validation

- **Outcome:** prevent malformed flag comparison operands from passing content
  validation. No malformed comparisons were found in shipping content.
- **Reproduction:** `gte` with no value or a string value, and `lte` with a boolean
  value passed both `conditionSchema` and `validateContent`. These numeric
  comparisons then stayed false for every flag value.
- **Acceptance:** `gte` and `lte` require numeric operands, including valid zero,
  negative and fractional values. Equality with or without an operand, equality
  against false, zero or an empty string, and `set`/`unset` keep their semantics.
- **Compatibility:** operand-less equality can test strict flag absence, while
  `unset` also matches false, zero and empty strings. The contract does not
  prohibit operand-less equality, so this fix deliberately preserves it.
- **Location:** branch `codex/validate-flag-comparisons`, based on
  `dd76430c8c6e5cc28df182d3c30d31dc569e2389`.
- **Scope:** only the flag condition schema and regression fixtures. Do not
  change the global flag-value schema, TypeScript condition shape, runtime
  evaluator, save format, story text, quest outcomes, journal prose or portraits.
- **Coordination:** intake found no competing flag-condition validation claim.
  PR #304 changes a scene field near the map schema; PR #306 has no schema diff.
  PR #307 independently validates character/story references in the late content
  scanner. Portrait/expression work remains with its existing coordinator.
- **Verification:** the final narrower regression suite, typecheck, independent
  source review and full `npm run ci:local` gate are required before publication.
  Exact tested revision and results belong in the PR description.
- **Delivery:** publish a reviewable PR only after checks pass; do not merge,
  enable auto-merge, deploy, dispatch extra CI, request paid review or generate
  assets. Preserve PR #307 and its exact-head hosted run independently.
