# CI description alignment — issue #366

- **Updated:** 2026-11-03 UTC. Integration owner: the current Avatar queue session.
- **Outcome:** The coordination guide states one-day CI artifact retention and the bundle-check label states the enforced 380 KB gzipped limit. Only descriptions change; workflow behavior, tests, product files and budgets remain unchanged.
- **Integration:** Current main `0d4c2b938f56bd5f8853323b0ea85d13b9a61ff2` was merged into the existing PR branch with merge commit `54ab2c9561efc30e6c293e9446c50ca7385877e3`. Existing source commits are preserved; no rebase or force push.
- **Location:** `D:/UserTemp/avatar-merge-371-20261103`, branch `codex/366-ci-descriptions`, existing PR #371. Other checkouts and branches remain untouched.
- **Authority:** Jared's 2026-11-03 instruction supersedes historical draft-only/no-merge instructions. Follow `AGENTS.md` Automatic merging and issue #348's sequential queue. No new PR is needed.
- **Verification:** Fresh exact-head `npm run ci:local` must pass all nine stages before push. Required checks must pass on that pushed head before merge. Record actual results in PR #371; earlier-head results do not authorize this revision. No invented unit test is needed for wording.
- **Dispatch:** No manual browser/gallery dispatch is required: the diff against current main changes descriptions and this handoff only. This does not assert actual browser/gallery execution from skipped aggregate jobs.
- **Next:** Validate the final clean head, push this branch normally, mark the existing PR ready, enable auto-merge with method `MERGE`, confirm the merge and tick its existing map row in issue #348. No admin override or bypass. PR #275 remains outside this assignment.
- **History:** Initial source `8de0afe3758666c9bbb2cd8f8f71a0197fd61647` and prior handoff `ffa049909701f7f35df353983e8230f555543203` remain in Git. Their older delivery restrictions are superseded; their validation is not reused as the new-head gate.
