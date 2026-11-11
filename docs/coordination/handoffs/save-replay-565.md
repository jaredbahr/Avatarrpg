# Save inspection CLI (#565)

Owner: continuous gameplay quality, `root/save-replay565-20261110`.
Branch: `codex/save-replay-565`, from main `30815ebb`.
[Verified pre-edit claim](https://github.com/jaredbahr/Avatarrpg/issues/565#issuecomment-6766439187).

Current saves contain a state snapshot and human-readable combat-log strings,
not a command history or its starting checkpoint. This task uses the issue's
explicit current-format fallback: load through `deserialize`, then the core
reconciliation sequence used by `App.load`, and report the current state.
Never reconstruct commands from prose or present two snapshot loads as a
verified command replay. Requested command ranges and `--verify` must clearly
report unavailable history with a nonzero result.

The input file is read only. No recorder, save-format/schema change, migration,
core rule, app, renderer, art, story or dependency change belongs to this task.
Actual command recording needs a separately approved contract for the base
checkpoint, typed commands, compatibility, size/privacy bounds and replay
tests; the proposal is recorded on the issue, not implemented here.

Owned paths are `scripts/replay.ts`, `scripts/replay.test.ts`, one npm script
in `package.json`, Commands documentation in `README.md`, and this handoff.
Preserve the README disclaimer verbatim. Other save/type/browser assignments
retain their owners; this branch does not incorporate draft PR575.

Validation retained in `/workspace/avatarrpg-env/save-replay565/`:

- Typecheck, scoped lint/format and ten test files pass: 217 tests, comprising
  29 CLI controls plus the unchanged 188 save tests.
- Ten actual npm-process controls pass, using paths with spaces: text/JSON
  inspection, dead-active repair, unavailable verification/ranges, bad options,
  corrupt/newer/missing saves and JSON help. Every input byte hash is unchanged.
  JSON stdout contains exactly one document and the expected exit codes.
- A supported imported dead-active snapshot is serialized and loaded through
  the actual core. Repair changes the actor and appends a real turn message;
  the report includes the exact complete reconciled log. This is an imported
  repair control, not an earned campaign or a command-replay witness.
- Independent SOL High review caught the initial misleading saved-prose label.
  The corrected label and help explicitly include load-repair entries; the
  actual repair regression control passes. No failing run is claimed for the
  initial text-review finding.
- The package differs only by the replay command. README text outside Commands,
  including the disclaimer, is byte-identical. All existing core, content, app,
  renderer, public assets, e2e, workflows and lockfile are unchanged.

Publication requires exact clean final-head `npm run ci:local`. Record that
result, source identity and actual hosted jobs/skips in the draft PR. No new
native gameplay acceptance is claimed for this unshipped developer tool.

Keep DRAFT. No merge, deployment, dispatch/rerun, install, paid request,
generated asset or security/access change is authorized by this handoff.
