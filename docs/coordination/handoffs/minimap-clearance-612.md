# Exploration minimap clearance (#612)

Root integration owner: `root/minimap-clearance612-20261111`.
[Before-edit claim](https://github.com/jaredbahr/Avatarrpg/issues/612#issuecomment-6784438142).
Branch `codex/minimap-clearance-612`, stacked on own tested draft609 head
`ee57a21af26acfb50443a00bfa7ff335dfed2910`, tree
`4d048e8f4522ec899cf9479f59fc79d5e1869915`; planned PR base
`codex/local-map-labels-608`. Only this task's three files belong in its diff.
Original main455/tree68c64 and the pre609 producer remain baseline evidence.

At 844×390 Largest text, the HUD minimap extends below the map viewport and
intercepts Look around. Discovery retained 1 pass / 1 failure, including an
actual unforced click timeout; portrait passed the existing seat/wait/journal
flow. Log SHA256 `02aac6090616f51a44537084d8c43b0863ca1649f2769ddd66c30337731a6bf2`.
That producer was draft609; its dialog-only label correction does not affect
the HUD corner. A separate pre609/main-equivalent census confirmed overflow
at all three text sizes at 844×390; it is telemetry, not acceptance.

Scope: root owns only new exploration-corner responsive rules in `hud.css`;
the author owns new `e2e/minimap-clearance.spec.ts` and this handoff. Suppress
the redundant landscape corner at Normal ≤416px, Large ≤512px and Largest
≤640px viewport height. Preserve dock Map → Local map → Follow party access,
full tap targets and complete retained widgets above the boundaries and in
portrait/tablet. No scene, camera, rules, content, art, assets, shared helpers,
existing tests, budget or workflow changes. #608 remains on its separate
delivered branch and is inherited once as this stack's explicit dependency.

The nine-case regression covers three landscape Canvas sizes, Largest
landscape WebGL, three portrait Canvas sizes and Normal/Largest tablet Canvas.
Actual dock centre hits and Look around open/close accompany geometry checks;
reading preserves full state/session/RNG/camera. A real canvas drag changes
only camera, and the real full-map Follow party action restores it. Real Tab
cycles exclude a hidden corner. Canvas landscape cases check exact boundaries,
one pixel above, and resize back. Largest portrait also walks to Mira's table,
waits until next-day dawn, and reads/closes the journal. Existing 60s deadlines
remain; no retry, forced click, clock mutation or assertion weakening.

The original focused regression was 2 fail / 1 pass, stable 45.945s, log
`f31cba40fe8cba9c2a79e7bdbb362a4d447d1d44f01d6d185eeaabbd2672f8c4`.
Normal landscape failed intended corner visibility plus the separately known
#608 dialog-SVG collapse; Largest portrait failed only startup-versus-manual
camera offsetY423→422, with state/session identical; tablet passed. Preserve
the original source/report/media and exact identities. The stack reuses #609
without removing the SVG assertion. A real Map→Follow action after Settings
establishes canonical manual centring before the initial snapshot, with full
state/session equality before/after preparation. The later exact drag→Follow
camera-return assertion stays unchanged; no tolerance or camera hook is added.

Repaired focused RED on the inherited #609 build: **1 fail / 2 pass**, zero
skips/retries/flaky/global errors, stable 38.204s. Log
`9f93b2ef71d78e293708bf213feca29afa6ee3f14b99b69b6d1e70606788036b`.
Normal landscape failed only corner visibility/overflow and its accessible
Follow target. Actual Look around, full-map/recenter and exact camera controls
ran successfully; Largest portrait/tablet passed. No assertion was removed.

Only the three scoped responsive media rules were then added. The new probe
stayed byte-identical from the repaired RED. Own working build passed 32.648s,
log `92879180ef7e14f75dc305e6f1267aabc1cccb3934d91139d6b31a2dbbec7052`.
Complete preliminary native matrix: **9/9 passed**, zero skips/retries/flaky/
global errors, stable 88.458s; actual Canvas and software WebGL. Log
`444d424767c9fe15879de5b6de9e5021db8545b47efa18b97bcfd8884693a1ae`;
raw report `fe75e6b5de4c1b4aa7c966b89a4d73ea83ad3a69dead9581d219c7ee75d6a41c`.
Root inspected all nine full dock captures: actions are exposed in short
landscape, the corner remains in portrait/tablet, and current art is preserved.
The existing narrow world strip, cramped hint and clipped roster details in
short Largest layouts remain broader #492/player-view limitations; this does
not claim complete HUD, device or visual-design acceptance.

Independent source/harness review is clear. Exact clean final-head
`npm run ci:local`, native on its fresh output, complete output identity and
independent final evidence review remain **pending** before publication.
Original discovery, census, first and repaired RED artifacts/source/config
versions remain outside Git under their recorded directories and
`/workspace/avatarrpg-env/minimap-clearance612/`.

Keep DRAFT. Physical input/device, WebKit/Safari/PWA and owner visual acceptance
remain open wherever unrun. No install, art generation, paid service,
security/access change, Ready/merge/deploy or dispatch is authorized here.
