# Difficulty regression tests — issue 516

Owner: Codex orchestrator; bounded test implementation by gpt-6-luna at Medium.
Branch: `codex/issue-516-01a1b3cc`, based on `94cac3a`.

The change adds `src/core/rules/difficulty.test.ts`. It covers every authored
enemy and encounter baseline at party sizes 1–6, retained rosters and bosses,
160 seeded valid-stat samples, and actual victory XP events across all six
party sizes. A conditional-enemy fixture checks both battle construction and
the resulting reward. Production rules, content, dependencies and timing
criteria are unchanged.

Issue clarification: the Slinger has legal zero defense. Only HP must remain
positive; other combat stats must retain their authored values. The current
difficulty API has no level-slop input, so these tests add no speculative
ADR 0011 behavior. See the source clarification on issue #516.

The focused test file passed all seven tests. Acceptance requires the unchanged
`npm run ci:local` and the required checks on the current PR head. The PR
description is the authoritative record of their actual results and remaining
work. Local tooling is Node 24.19.0, npm 11.11.0 and Python 3.12.10; hosted CI
uses Node 22. No physical-device or visual behavior changes are claimed.
