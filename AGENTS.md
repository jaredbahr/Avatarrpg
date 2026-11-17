# Working in Avatar RPG

Read `CLAUDE.md` before changing this repository. Its architecture, validation,
art, and device rules apply to every coding agent.

## Coordination and continuity

Before taking work, read [the coordination entry point](docs/coordination/README.md)
and [the current slice](docs/coordination/quarry-slice.md). Check live branches,
PRs and the assigned owner's handoff before editing; recorded status is a snapshot.

Jared authorizes the main orchestrator to assign priorities, create or replace
sessions, and direct delivery. The current finish line is a polished village to
quarry and back run. Complete and review that slice before expanding the world.
Use the model routing policy below. Use an isolated worktree per coding session and
one integration owner for overlapping changes. Preserve useful work from other
agents; do not overwrite it merely because your branch started earlier.

Keep task state and evidence in a PR and a concise
[handoff](docs/coordination/handoff-template.md). Update at meaningful milestones
and before transferring work. New sessions must verify the actual branch, head,
uncommitted files and current checks before continuing. Compaction alone is not
a reason to duplicate an active assignment. Session workflow and documentation
ownership are detailed in the coordination entry point.

**Story, dialogue and scene planning have one owner (Jared, 2026-11-14).** The writing pass, one session at a
time, writes every scene, line and scene plan, in story PRs that carry a theme card and wait for Jared's yes. Any
other session builds from what is on `main` and does not draft story text. If your work needs words that do not
exist yet, leave a clearly marked placeholder, say so in your PR, and stop there. Story decisions are recorded in
[docs/story-bible.md](docs/story-bible.md); read its owner-decision sections before touching anything a player
reads.

## Model routing and usage

Jared's standing routing policy:

- Orchestrator and final visual judgment: GPT-6 Astra Low normally; Medium for
  important planning, architecture, combat-system or visual-direction decisions.
- Ordinary implementation: GPT-5.6 Luna High. Mechanical cleanup, documentation,
  repetitive wiring and straightforward tests: Luna Medium.
- Substantial but well-defined implementation: Luna Max when justified; Max is
  not the default for every task.
- Escalation: GPT-5.6 Terra or Sol High through Max for cross-system bugs,
  difficult renderer/pathfinding work or a reasonable Luna attempt that failed.
  Record the reason rather than retrying blindly.
- Do not assign Astra workers ordinary implementation. Keep expensive reasoning
  focused on decomposition, architecture and review against the visual target.

Plan then execute without routine user approval. Delegate bounded implementation
to the appropriate worker; inspect results and validate actual gameplay before
acceptance. Preserve the references, story bible, ADRs and game vision instead
of lowering the target to match current limitations.

Use explicit model/effort parameters when available; never claim a model change
without applying it. Preserve active work at a checkpoint before changing owners
or routing. Current tool concurrency limits still apply: 6–10 workers is not a
quota, and cheap workers do not justify duplicate work, uncontrolled parallelism
or extra CI runs. Use the smallest effective team and batch validation.

This is an operational preference, not a guarantee of API prices, plan allowance
savings or model capability. Do not copy unverified pricing claims into budgets.

## Automatic merging

Jared's standing instruction: all completed work on this project merges
automatically after its checks pass. Do not ask him to approve each merge.

- Work on a branch, run `npm run ci:local` and get green before any push, then
  open a pull request into `main`.
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
