# Working in Avatar RPG

Read `CLAUDE.md` before changing this repository. Its architecture, validation,
art, and device rules apply to every coding agent.

## Automatic merging

Jared's standing instruction: all completed work on this project merges
automatically after its checks pass. Do not ask him to approve each merge.

- Work on a branch, run `npm run verify`, and open a pull request into `main`.
- Keep unfinished work in a draft. Mark completed work ready for review and
  enable auto-merge using a **merge commit**, preserving individual commits.
- Required CI checks are `Typecheck, lint, unit tests`,
  `End-to-end (Chromium touch, WebKit iPad)`, and `Screenshot gallery`.
- A new commit needs checks for that new commit. Passing checks on an earlier
  commit do not authorize a merge.
- Fix failing checks, merge conflicts, and outstanding review feedback. Never
  skip checks, weaken branch rules, force-push `main`, or use an admin override
  to make a merge happen.
- If GitHub cannot queue auto-merge, inspect the reason. Once the current
  revision passes all checks and is mergeable, merge it with its expected head
  SHA and `merge_method: merge`. Report an actual blocker rather than asking
  Jared for another routine merge approval.
- Confirm whether a PR is queued or merged; do not claim either without checking.
