# Duplicate battle-readiness guard — #370 source candidate

Owner: `sol_story_snapshot`, assigned after the integration owner verified the
same #370 claim update at 19:34 UTC. Isolated branch
`codex/370-readiness-guard` starts at story-snapshot documentation head
`9223096cdea3c6a6fbbb940753056bc08e882fe2`. The prior worktree is preserved.
This remains a source candidate for draft PR #373, with no separate landing
PR, auto-merge, main merge or deployment.

Only two lines are removed from `finishBattle`: the outer phase evaluation
and its immediate non-active break. The next unchanged `takeTurn` call already
returns false for missing/non-active battle, before its opening wait, ready
count or real click. The same outer loop then breaks. The entire helper,
action strategy, full-state/AP/position reads, commands, all assertions,
160-turn/8-action bounds, final victory expect and visible Continue are
unchanged. Story snapshot source and its selector contract remain unchanged.

The bounded contract is one isolated encounter, no outside writer/player,
reset, reload or replacement battle. Legal move/ability/end-turn/AI handlers
refuse terminal battles; AI scheduling and dispatch check active phase.
Normal resolution is the real Continue control after the final victory expect.
Under that contract, terminal phase does not become active again. An external
terminal-to-active replacement is an explicit counterexample outside this
contract, not a general equivalence claim.

Both independent helper waits still use 25 seconds. Removing a preceding RPC
moves the first wait's absolute start/deadline earlier; it may fail earlier in
wall time. A terminal iteration now enters a bounded 25-second helper wait
instead of the old phase evaluate's whole-case bound. Installed Playwright
evaluates that initial predicate immediately, so stable terminal state returns
over without needing an extra RAF. No blanket identity of timeout categories,
transport errors, absolute wall outcomes or real actionability is claimed.
The unchanged helper retains both predicates and independent budgets, exact
accessible role/name count, real click actionability and solo no-card behavior.

The immutable escort inventory from original source `33f4c2b5` records 24
outer phase evaluations and two terminal outer-guard short circuits. On that
recorded control flow, removing 24 evaluations adds two helper over paths,
each with waitForFunction plus jsonValue: structurally 20 fewer API operations
net. This is not a candidate runtime count, measured saving or hosted fix.
The separate policy capture remains rejected; no policy/AP/actor hypothesis
is incorporated as a proven optimization.

Root and independent source review cleared this exact bounded proposal before
implementation. The external comparison proof is
`/workspace/avatarrpg-env/review-drafts/370-readiness-guard-no-browser-proof.cjs`.
One execution passed 15 controlled gate/helper cases, including terminal and
missing battle, readiness, both independent timeouts, nearly 25 seconds for
each wait, no-card and propagated rejection cases. Both deliberate negative
cases confirmed the expected differences: an earlier absolute first deadline
can tighten an outcome, and external terminal replacement violates the bounded
contract. The proof verifies the exact two-line spec deletion and byte-identical
helper; the rest of the action body is unchanged source, represented only by
an entry marker in the controlled harness. It cannot prove real actionability,
actual battle execution, throughput or browser acceptance.

Pinned typecheck, touched-file ESLint/Prettier and `git diff --check` passed.
The durable receipt is
`/workspace/avatarrpg-env/review-drafts/370-readiness-guard-source-validation-run1.receipt.json`;
it records actual exit 0 for each stage and stable initial/final head, tree and
file hashes during that validation. Head remained `9223096c`; spec SHA256 is
`705f54546c7a3f46c2006dfcdc0f713037baab126b1121f39ca0490bfdba5c12`,
and helper SHA256 remains
`f140b53294186e62e2a1eebbff1fdc2e63e9fd67f9b51058aedf2923922d1a05`.
This handoff was then updated with those actual results before source commit
`fafb5a786ce0bf56724187319d0794ac3cca4c74` and root's browser release.

## Original-route validation at source `fafb5a78`

One invocation passed both complete original campaigns, with one worker and
one attempt per case, zero retries, unchanged 600-second case budgets and the
repository 10-second expect budget. Installed system Chromium
(`/usr/bin/chromium`) ran production Canvas at 1194×834, DPR 2, with touch.
The published `72b0436` app dist was reused only after production inputs in
both source and app worktrees matched published `72b04367`; no rebuild was
needed.

| Original case                     | Result | Case duration |
| --------------------------------- | ------ | ------------: |
| Trade, save/reload and walk home  | Passed |     169.370 s |
| Escort, save/reload and walk home | Passed |     264.754 s |

Actual process exit was 0; the JSON report has two expected passes and no
errors, skips, flaky or unexpected results. Suite duration was 439.523 s;
wrapper wall time was 440.174 s, including trace retention and teardown.
The external config retained passed traces with `mode: 'on'`, preserving
canonical `snapshots: true`, `screenshots: false` and `sources: true` recording.
No extra query, screenshot, command or case was introduced. These results do
not establish attributable timing improvement, actual candidate API counts
or a hosted budget fix.

The unique run prefix is
`/workspace/avatarrpg-env/370-readiness-guard-fafb5a78-routes-run1`.
Its atomic `.receipt.json` records actual exit 0 and stable initial/final source
head `fafb5a78`, helper, app head `72b04367`, config and dist hashes. Spec and
helper hashes remain the values above. Both passed traces, config, wrapper,
receipt, JSON report, logs and manifest were archived before further parsing
or reuse under
`/workspace/avatarrpg-env/evidence/370-readiness-guard-fafb5a78-routes-run1`.
The separately preserved initial list-only preflight did not launch a browser
and is not browser validation. Final corrected config listing selected exactly
the two original cases; the derived summary uses the run prefix plus
`-case-summary.json`.

Root read the actual terminal receipt and case JSON and accepted this bounded
local route proof. This documentation checkpoint precedes integration and the
final committed-head nine-stage check. Subsequent exact integrated head and
gate results belong in the PR, same live claim and external receipts, without
tracked edits after the final check. No integration, full nine-stage run, push
or hosted dispatch is claimed here. Hosted matrices, consecutive-green and
native acceptance requirements remain open.

The new bounded DeepSeek negative-case matrix job was
`avatar370-readiness-guard-negative-cases-20261030`; its receipt/output/SOL
review remain outside Git. No additional job was needed for implementation.
Root controls validation and the next CPU window. All final-head local gates,
hosted matrices, consecutive-green and native acceptance requirements remain.
