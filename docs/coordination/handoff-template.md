# Task handoff template

Copy this into the task's PR description or a task-specific handoff. Replace every
placeholder; use "not run" or "unknown" rather than implying verification.

- **Updated:** UTC timestamp; outgoing owner/session; incoming owner if assigned.
- **Outcome:** one bounded player-visible or maintenance result; explicit exclusions.
- **Acceptance:** observable conditions that make this task complete.
- **Location:** repository, worktree path, branch, exact HEAD, base/dependencies, PR.
- **Worktree state:** clean or list uncommitted/untracked work; local-only assets;
  running processes that matter; any work not yet pushed.
- **Completed:** concrete changes and relevant paths; distinguish merged and pending.
- **Decisions:** rationale and links to authoritative design/ADR documents.
- **Verification:** tested SHA, command/check, result and evidence link; tests not
  run; outstanding visual/physical-device checks. A new head invalidates old CI.
- **Coordination:** owned files/contracts; other owners and PRs; merge order;
  unresolved conflicts or feedback.
- **Next actions:** short ordered list with exact reproduction steps for blockers.
- **Completion/transfer:** confirmed merged SHA or pending status; successor task;
  whether the outgoing owner has relinquished editing ownership.

Do not copy credentials, full logs, hidden reasoning or entire conversations.
The next session reads referenced files and verifies live state before acting.
