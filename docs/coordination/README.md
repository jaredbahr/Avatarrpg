# Project coordination

This is the entry point for a new or resumed working session. Keep it small:
link to authoritative documents rather than copying their rules into every task.

## Start or resume

1. Read `AGENTS.md`, `CLAUDE.md` and [the current slice](quarry-slice.md).
2. Read only the design references and subsystem files needed for the assignment.
   Presentation work also reads `docs/player-view-target.md`; art work reads
   `docs/art-bible.md`; device work reads `docs/device-matrix.md`.
3. Read the previous owner's PR and [handoff](handoff-template.md). Check
   `git status --short --branch`, `git worktree list`, current remote refs, open
   PRs, their exact heads and checks. Never treat a chat summary as current Git state.
4. State a bounded outcome, owner, files/contracts likely to change, dependencies,
   and acceptance evidence. Resolve overlap with the orchestrator before edits.
5. Use an isolated branch/worktree. Do not switch or clean another session's
   checkout. Use the lockfile for dependencies; keep build outputs and temporary
   probes out of commits. Never commit credentials or machine-specific secrets.

## Where information belongs

| Information                             | Authoritative home                                   | Maintenance                                                        |
| --------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------ |
| Agent entry and merge policy            | `AGENTS.md`                                          | Orchestrator; do not duplicate policies                            |
| Architecture and validation rules       | `CLAUDE.md`                                          | Update when the actual contracts change                            |
| Current scope and acceptance            | [Quarry slice](quarry-slice.md)                      | Orchestrator; evidence required to mark complete                   |
| Future sequence                         | `docs/roadmap.md`                                    | Keep future scope separate from current commitments                |
| Lasting technical decisions             | `docs/adr/`                                          | Follow CLAUDE's ADR triggers; check existing numbers before adding |
| Art, player view, device specifications | Existing bibles and target documents in `docs/`      | Respective discipline owner                                        |
| Task implementation and live CI         | GitHub PR, commits, checks and review threads        | Task owner                                                         |
| Session transfer                        | Concise handoff in the PR description or task record | Outgoing owner; incoming owner verifies                            |
| Playthrough and visual evidence         | Linked CI artifacts / review report tied to a commit | Reviewer; distinguish automated and physical-device checks         |

If work has no PR yet, use `docs/coordination/handoffs/<task-slug>.md` on the task
branch, using the template. Link it in the eventual PR. Before a session transfer,
commit and push it when verification allows; otherwise explicitly tell the
successor where the unpushed files live and preserve that worktree. An ignored
local file is not a durable cross-machine handoff. Do not commit transcripts,
generated reports or screenshots merely to preserve context. Link stable evidence
and retain only decisions, unresolved problems and reproducible next actions.

The orchestrator maintains the active assignment table in the slice document at
ownership changes. Task owners update their own PR/handoff at milestones, so
routine status updates do not make everyone edit a shared file. Close or archive
obsolete tasks with successor links; retain history in Git instead of accumulating
contradictory current-status documents.

## Parallel work and session lifetime

- Give each task one integration owner. Coordinate shared files and contracts
  explicitly: narrative text belongs to writing, rules and UI to gameplay, visual
  assets and sound to art. A mixed change needs an agreed integration sequence.
- Keep one coherent task in its existing session while that context is useful.
  Compaction can continue normally. Start a new session for a distinct deliverable,
  a completed milestone, or a context that has become confusing; there is no
  arbitrary message-count restart rule.
- Before replacing a session, preserve its handoff, branch, uncommitted work and
  verification state. Explicitly transfer ownership and stop the old owner from
  editing that task. A fork or fresh session does not automatically know unfinished
  work, local assets, tool state, goal budget or running processes.
- Start new independent tasks from current `main`. For unfinished work, use the
  recorded branch or an explicit branch based on its head. Do not cherry-pick or
  replay the same implementation into multiple competing PRs.
- Use agents for bounded independent implementation, audits or reviews when
  useful. More agents are not an objective: split only genuinely independent
  work, avoid duplicate assignments and arbitrary worker counts, and avoid
  concurrent large test/art jobs that exhaust the host. Use Luna by default for
  routine bounded implementation, tests and documentation; use a stronger model
  when the complexity warrants it. Preserve the handoff before replacing a
  session, and stop superseded owners from editing. Prefer Astra for art and
  audio; complex art work may still justify a stronger model.
- On completion, verify the merge, capture remaining issues, and transfer the next
  assignment. Remove old worktrees only after confirming all useful work is saved
  and no session or process still uses them.

## Structure as the game grows

Preserve the existing core/content/app/render boundaries in `CLAUDE.md`. Author
new content as schema-validated data, organize larger content by region or feature,
and keep one source of truth for state, conditions and predictions. Extend existing
systems before introducing a parallel subsystem. Extract a reusable abstraction
when concrete repeated behavior warrants it, not for speculative future regions.
Changing save fields requires schema/migration review and round-trip coverage.

Keep runtime assets separate from source references, generation inputs and review
artifacts; honor existing asset contracts and budgets. Record provenance and import
steps in the established art documentation. Update affected docs with the change,
and explain any superseded decision instead of leaving competing instructions.

## Verification and reporting

### Playable release versions

Jared requires a new visible release version for each delivered playable update
so he can identify what to test. A build hash alone does not meet this requirement.
The integration owner increments the package version (and matching lockfile
metadata), updates the release notes, and verifies the version shown by the
deployed game. Use patch increments for iterative playable improvements and
minor increments for larger feature milestones. Include this change before
final verification and exact-head CI, not after checks pass. Report the release
version, play link and meaningful testable changes; keep the build hash as
secondary diagnostic information. Do not bump versions for unshipped source
checkpoints or handoff-only commits.

### Keep CI work proportional

CI runs once per pull-request revision, on `main` pushes, and on explicit manual
dispatch. Do not dispatch a second run while the required PR run is active. The
browser job waits for verification to pass, and the gallery waits for both
verification and E2E. Both divide their cases across parallel shards and keep
the required check name on the aggregate job that depends on them. Failed
gameplay revisions therefore do not spend gallery capture minutes. All required
check names, suites and latest-head merge rules still apply, including to drafts.

Batch related local edits and focused checks into a coherent verified milestone
before pushing. Preserve a handoff before a session ends, but do not push every
intermediate experiment or repeatedly update a branch merely to restart CI.
Choose one landing PR for each change. Source PRs own their changes; use local
combined branches for integration review and bring merged `main` into the final
acceptance-test PR. Do not publish the same source changes in several competing
integration PRs. When consolidation is necessary, explicitly transfer ownership
and supersede the old PRs before starting another full run.

CI gallery and browser-report artifacts expire after seven days. Record the
tested revision and review findings in the durable handoff; download evidence
needed beyond that window. Normal Pages deployments build only the game. See
[the gallery guide](../gallery.md) for optional manual gallery publication.

Follow `AGENTS.md` for verify-before-push, PR readiness, current-head CI and merge
commits. Add focused tests for meaningful behavior changes; documentation alone
does not need invented unit tests. Integration review checks the combined game,
not just each isolated PR. Link evidence to its tested commit and clearly label
unverified physical-device behavior. Never equate a generated concept image with
implemented gameplay or a green unit suite with a satisfactory player experience.

Send Jared updates for playable milestones, substantive decisions and blockers.
Keep repeated CI polling out of user updates. The orchestrator's scheduled check
is a recovery mechanism; PRs and these documents retain the work if a session ends.
