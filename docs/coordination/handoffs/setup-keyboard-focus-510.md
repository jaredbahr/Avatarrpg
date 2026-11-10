# Party setup keyboard focus (#510, discovered during #491)

- **Owner:** Codex root, session `keyboard-flow491-20261108/setup-focus510`,
  branch `codex/setup-keyboard-focus-510`, isolated source at
  `/workspace/avatarrpg-env/keyboard-flow491/source`, based on
  `1c273d2a004456679d3cdb5949773b5e864eaeff`.
  [Verified claim](https://github.com/jaredbahr/Avatarrpg/issues/510#issuecomment-6721315638).
- **Reproduction:** keyboard Enter on New game rendered setup with focus on
  `body` and no focus-visible outline. Count changes, name submission, path and
  character choices, Next, Confirm and Back removed the focused control when
  `PartySetupScene.render` replaced its DOM. Only name entry restored focus.
- **Fix:** after rendering setup, focus the name input, selected enabled count
  or card, first available card, enabled primary action, or remaining button,
  in that order. Use native focus scrolling so a selected card in a rebuilt
  scroll panel remains reachable. Preserve browser input modality and focus
  styling; pointer actions do not force a keyboard ring.
- **Boundary/ownership:** only setup rendering changes. Names, default naming,
  wizard order, party/character choices and the name Enter handler remain
  intact. The same root owns completed #419/PR420; explicit self-coordination
  is recorded on [its existing claim](https://github.com/jaredbahr/Avatarrpg/issues/419#issuecomment-6618043013).
  The independent IME guard and old branch/evidence are preserved; integration
  must retain both fixes. No global focus manager, combat targeting, movement,
  story, core, assets, dependencies or configuration changes.
- **Regression coverage:** actual keyboard-only one- and two-player setup,
  Enter/Space/typing/Tab/Shift+Tab, selected count/card restoration and Back,
  both handoffs, default blank name and real session/character bindings after
  Begin. Assert focused, enabled, visible and in-viewport controls plus actual
  `:focus-visible` and nonzero visible outline immediately after each step,
  before a recovery Tab could hide failure. Solo uses the fifth path/Riko;
  two players use fire/Kaya and water/Nilak. A separate mouse/touch flow checks
  normal selection and absence of a forced keyboard ring. Existing 600×900
  Huge-text setup-polish remains a separate unchanged positive control.
- **Evidence:** unchanged-runtime baseline strictly failed New game→setup.
  The original diagnostic also failed an incorrect nearby-Mira selector;
  corrected real Map→Walk to Elder Mira succeeded while recording focus losses,
  explicitly not full-flow acceptance. Source/build/probe manifests, original
  failed scripts/logs/reports/traces and snapshots are retained externally.
  Baseline build producer `982e5e6` had only golden-save test/data/script/handoff
  differences from main; bundled runtime/public/config equivalence was verified.
  First candidate rendered checks passed 10/10; review then removed preventScroll
  and added fifth-card/viewport coverage. Revised rendered checks passed 10/10
  across desktop, portrait and compact Chromium plus the unchanged Huge-text
  control, without skips/retries/flakes. Exact clean final-head CI/native results
  and complete commit/tree identities are recorded in the draft PR after running.
- **Full #491 remains open:** actual focus losses after Begin, exploration entry
  and world conversation transitions need existing scene owners. Explicit
  handoff requests are on [PR310](https://github.com/jaredbahr/Avatarrpg/pull/310#issuecomment-6721306659)
  and [PR450](https://github.com/jaredbahr/Avatarrpg/pull/450#issuecomment-6721306811).
  Those files remain read-only until an explicit handoff. This bounded child
  does not truncate a failing full-flow test or claim dialogue, target selection,
  first-turn, physical-device, WebKit, listening, performance or PWA acceptance.
- **Delivery:** draft only; exact clean final-head `npm run ci:local` before any
  branch publication. Keep corrections on the same PR and preserve failures.
  Actual hosted leaf jobs/skips must be reported; aggregate green is not browser
  coverage. No merge, deployment, dispatch, install, paid API, security change
  or new art. Shared byte-identical derived caches are frozen; detach before
  any future writes. Task evidence lives under `/workspace/avatarrpg-env/keyboard-flow491/`.
