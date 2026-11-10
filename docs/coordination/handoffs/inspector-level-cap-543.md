# Inspector level-cap label (#543)

Codex owns `codex/inspector-level-cap-543`, based on main
`85ad186880063b707dbf46808349c35b340409b1`.
[Issue](https://github.com/jaredbahr/Avatarrpg/issues/543) and
[verified claim / current validation](https://github.com/jaredbahr/Avatarrpg/issues/543#issuecomment-6736443840).
The eventual draft PR records exact delivered head, tree and final gate results.

The inspector previously promised “Level 10 — 100% to level 11 (0 XP to go)”
although the existing rules cap progression at `MAX_LEVEL`. It now says
“Level 10 — Maximum level”. The existing below-cap interpolation is unchanged.
Only the inspector display, a dedicated regression spec and this handoff change;
XP, progression, story, party composition, content, styles and art do not change.

The rendered baseline uses a normally validated save with canonical XP.
Level 9 / 2200 XP passes; level 10 / 2700 XP fails on unchanged inspector source.
The production inspector blob at baseline producer `0aa06766` equals main's.
The earlier fixture supplied a high level through `newGame`, which starts at
zero XP; its two failures remain separate. Correcting that fixture did not alter
the below-cap expected behavior. These are explicit supported-save states;
level 10 is not claimed to be earned in the current Act 1 campaign.

Four dedicated Canvas cases cover phone 390×844 and iPad-size landscape
1194×834, each at Normal and Large text. Each adopts three serialized/deserialized
fixtures: level 9 / 2200 XP (0%, 500 XP left), level 9 / 2450 XP (50%, 250 left),
and level 10 / 2700 XP (maximum level). Actual roster controls open the inspector;
its title receives focus, text lines fit the visible panel, and Escape and Close
restore opener focus. Game state, session, camera, canvas geometry and backing
dimensions remain identical before, during and after each open/close cycle.

Initial production build/typecheck passes. Dedicated rendered checks pass 4/4,
12 fixtures and 24 open/close cycles, 23.338 seconds in the browser report.
Root inspected actual phone/iPad and Normal/Large captures, including wrapped
below-cap text. Independent source/test review is clear. These checks precede
final metadata; they are not substituted for final-head gates.

Delivery requires exact clean-head `npm run ci:local` plus native checks against
that CI build, including the unchanged dialog-focus controls. Final results and
actual hosted jobs/skips belong in the linked claim/PR. Source snapshots, logs,
receipts, original failures, traces and PNGs remain outside Git under
`/workspace/avatarrpg-env/inspector-cap543/` and
`/workspace/avatarrpg-env/level-cap-discovery/`.

Chromium viewport checks do not establish physical-device, WebKit/Safari or PWA
acceptance. No merge, deployment, dispatch, install or security change is included.
