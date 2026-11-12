# Table-vote layout at tablet text sizes (#664)

The owner reported that the vote banner pushed answers below the fold at
1180 × 820, especially at Largest text. The unchanged-main rendered baseline
also reproduced scrolling on the result and tie steps. The gate's long locked
answer and the staged Ruon custody choice are retained, not shortened.

## Source scope

The production change is one vote-only landscape block in `src/styles/hud.css`,
using existing spacing tokens, the existing compact 5rem portrait arrangement,
and the full available card width/height. It places the vote heading/control
on a wrapping row and keeps speaker tags, answer headings and revealed names
in a grid. Every label, explanation, locked reason, name, font size, portrait
asset and original 4.5rem answer minimum remains present. The media condition
excludes narrow, portrait and <=34rem short layouts. Other conversations,
choices, wait controls and portrait rules are unchanged.

`ConversationPanel.ts`, table-vote logic, settings, session, core rules, saves,
content and art are unchanged. This does not implement changing a vote, or a
general correction of the separate pre-existing non-vote speaker-column issue.

## Reproduction and regression oracle

Base: `597c3bb633bb16121750b0c483f6465c5fe3ff31` (merged table vote).
The new `e2e/table-vote-layout.spec.ts` uses 1180 × 820, DPR 2, real touch taps,
and Normal/Large/Largest text. It explicitly verifies each presentation:

- Gate world vote: three participants, a locked third answer and a 2–1 majority.
- Village chair world vote: three participants and a three-way tie.
- Ruon staged custody vote: two participants, two full answers and a tie.

Every pick, handoff and result/tie is measured before a tap can auto-scroll.
All answers, banner text and controls must fit the viewport and clipping
ancestors at natural scrollTop 0; the panel must need no vertical/horizontal
scroll. Checks retain tap minimums, answer order, voter names, secrecy, focus,
locked answers, unchanged state/session during voting and final ordinary
`chooseOption` dispatch. Original 60s/10s native limits and zero retries remain.
Frozen regression SHA256:
`bdb27dee6e20e6b7640d627c4d7ca9f86a57b9f880b4d9ae46d485e4542134ee`.

The frozen nine-case baseline on unchanged production output was **8 FAIL /
1 PASS**, with no skips/retries/flaky cases or global errors. Largest gate
pick/result needed 925/1063px inside a 469px panel; Largest Ruon tie needed
877px inside 539px. Baseline log SHA256:
`0a3b2c369ed8edb5d7856dd284dbf61a3ceec6d11641cece3b90413097f5e568`.
An earlier six-case baseline and the first candidate's **10 PASS / 1 FAIL**
(20px residual footer overflow on Largest Ruon tie) remain preserved separately.
No assertion, font size, timeout or tap minimum was relaxed to fix those failures.

## Qualification and remaining acceptance

This file records the reproduction and acceptance contract before final-head
qualification. The same claim and draft PR record the exact final commit/tree,
clean `npm run ci:local`, fresh eleven native cases (nine above plus both original
vote-semantic/solo cases), output hashes, screenshots and independent review.
Evidence is retained under `/workspace/avatarrpg-env/table-vote-layout664/`.
Claim: https://github.com/jaredbahr/Avatarrpg/issues/664#issuecomment-6820551117

Chromium Canvas with software rendering supplies coding coverage. It does not
complete physical iPad input, Safari/WebKit, PWA, device performance, browser
floors or owner acceptance; those gates remain open. Keep the PR a draft.
