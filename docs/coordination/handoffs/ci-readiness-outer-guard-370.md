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
This handoff was then updated with those actual results. Browser, build,
full nine-stage gate, integration, push and hosted dispatch remain unrun at this
validation checkpoint. Root reviews the results before source commit or browser
release.

The new bounded DeepSeek negative-case matrix job was
`avatar370-readiness-guard-negative-cases-20261030`; its receipt/output/SOL
review remain outside Git. No additional job was needed for implementation.
Root controls validation and the next CPU window. All final-head local gates,
hosted matrices, consecutive-green and native acceptance requirements remain.
