# Story snapshot batching — #370 source candidate

Owner: `sol_story_snapshot`, assigned by the #370 integration owner after the
same live claim was updated. Branch `codex/370-story-snapshot-batch` starts at
published integration `72b04367ff61c0469e23d26a816b9708c08de25d`. This is an
isolated source candidate for draft PR #373; no separate landing PR, push,
main merge, auto-merge or deployment is authorized.

## Evidence and scope

Hosted run [41101184175 WebKit 2/2](https://github.com/jaredbahr/Avatarrpg/actions/runs/41101184175/job/124222415099)
failed the original escort campaign on both attempts at its unchanged 600 s
limit: 35 passed, one failed, 93 unrun. Failure annotations measured 56/55
state reads taking 27.454/24.999 s and 71 separate class-count requests per
attempt taking 25.041/26.979 s. Three battles took 313.351/327.775 s. These
are completed-operation costs inside phases, not extra phase time or a
guaranteed saving. This candidate alone is not an established budget fix.

Only `continueStory` changes. Its existing one `page.evaluate` per iteration
returns the used facts: pending-choice length, screen, node ID, line index,
and the two existing class counts. It no longer serializes full game state
or makes the two conditional locator-count requests. Branch precedence,
Learn/Skip/parley/kinship/trade/escort/unlocked-choice/Next interactions, every
expect assertion, the 60-step bound, exhaustion error and phase completion
remain. Battle code and all other source outside this function are identical.
No helper, clock, seed, timeout, retry, product, assertion or strategy changes.

The real combined operation is labeled `read:snapshot`. Removed count requests
produce no count timing rows; their query work is included in the snapshot
duration. Existing click/assert timers retain their labels and boundaries.
There are no invented zero-duration count records or before/after savings.

## Selector and observation contract

`ui/dom.ts` creates ordinary document elements. `DialogueScene` mounts and
rerenders interlude controls through that helper; `ConversationPanel` creates
choice buttons the same way, including locked options. The source tree,
`e2e` and `index.html` have no shadow-root creation or declarative shadow DOM.
For this light DOM, the exact class selectors `.interlude-stage` and
`.choice-option` count all document matches, including hidden, inert,
disabled and locked elements. No visibility or unlocked filter is added to
the counts. The existing visible/actionable click locators remain unchanged.

This is not a general equivalence claim: Playwright CSS locators pierce open
shadow roots, whereas `document.querySelectorAll` does not. A future move of
these controls into shadow DOM requires revisiting this snapshot. The
no-browser proof deliberately demonstrates the different result for a
shadow-only class match rather than silently assuming equivalence.

The callback reads state and counts synchronously in one JavaScript task.
For story clicks, `App.dispatch` sets state then calls
`routeToState`/`showScene`/`mount` or `sync`/`render` synchronously; reward
dialog dismissal and offering the next choice are synchronous too. Interludes
start with `playing=false`, and Skip uses ordinary synchronous dispatch.
`App.dispatch` can defer an exploration transition with `routeTimer` while
walking: state and DOM are not universally synchronous. Existing campaign
walk callers complete authored playback, final timers/frames and idle before
calling `continueStory`. No extra wait, browser request or mount workaround
is introduced. Source review does not replace actual route validation.

## Source verification and remaining gates

The external reproducible proof is
`/workspace/avatarrpg-env/370-story-snapshot-no-browser-proof.cjs`, with output
`370-story-snapshot-no-browser-proof.log` beside it. It extracts the actual
original and candidate functions and executes their callbacks against
controlled state/DOM-count fixtures. All 436 comparisons pass, covering
branch combinations, both custody values, hidden/locked count answers,
missing state, 60-step exhaustion and original read/click/assert rejection
identity. An explicit shadow-only negative case confirms the limitation.
AST checks preserve every click and expect expression, one evaluate per
iteration and zero locator-count calls; source outside the function matches
the baseline exactly. This proves driver decisions under the stated inputs,
not browser selector-engine behavior, actionability or timing improvement.

Pinned typecheck, scoped ESLint, scoped Prettier and `git diff --check` pass.
No browser, build, full nine-stage suite, push or hosted dispatch was run for
this candidate. The integration owner must independently review source and
validate both complete original routes before considering integration. The
exact final integrated committed head still needs all nine local stages
before any push, followed by actual required hosted matrices. Hosted WebKit,
gallery, consecutive-green, physical-device and native acceptance gates
remain open.

One bounded DeepSeek test-matrix draft used the verified one-shot workflow,
job `avatar370-story-snapshot-negative-cases-20261030`; receipt and reviewed
output remain under `/workspace/avatarrpg-env/deepseek/jobs/`. SOL retained
implementation and judgment. Useful branch cases were incorporated into the
external proof; incorrect draft claims about count visibility, pagination,
optional required fields and telemetry naming were rejected.
