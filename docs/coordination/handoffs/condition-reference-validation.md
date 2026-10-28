# Condition-reference validation

- **Outcome:** prevent future content conditions from referencing a missing
  playable character (`partyHas.characterId`) or story node (`visited.nodeId`).
  The audit found no invalid references in shipping content.
- **Acceptance:** recursive checks reject unknown IDs at every condition-bearing
  content root, including nested `all`/`any`/`not`; valid references and element-only
  party filters remain accepted. Existing content continues to validate.
- **Location:** `jaredbahr/Avatarrpg`, branch
  `codex/validate-condition-references`, based on `593bafaff6cdc81940d3828e89c5ffc0a91d1afb`.
- **Scope:** the existing `validateContent` recursive condition scanner and a
  dedicated regression suite. No content-schema shape, story text, quest outcome,
  journal prose, portrait/expression schema, portrait loading or art change.
- **Coordination:** the parent selected this code-only audit gap. No competing
  condition-validation PR or issue claim appeared in the intake search. Portrait
  work remains with the existing coordinator; its schema regions are excluded.
- **Verification:** the focused suite passes all 15 cases; typecheck, formatting
  and `git diff --check` pass. Independent read-only source review found no
  blockers. Full `npm run ci:local` must pass before publication; its exact tested
  head and result belong in the PR description. Browser and physical-device checks
  have not been run for this authoring-validator change.
- **Publication:** this task is authorized to push a reviewable PR after the local
  gate, but explicitly must not merge or deploy. That task restriction overrides
  the repository's default automatic-merge instruction. Intake confirmed a public
  repository, standard PR runners, a 10 GB cache cap with one roughly 70 MB cache,
  and no automatic-review rules; branch publication does not deploy the game.
- **Next action:** complete the local gate and publish one coherent revision with
  exact-head evidence, then hand off to the parent for review. Do not dispatch
  extra CI, request a paid review, or generate assets.
