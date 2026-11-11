# Reachable exploration movement hint (#614)

Root integration owner: `root/explore-hint-scroll614-20261111`.
[Before-edit claim](https://github.com/jaredbahr/Avatarrpg/issues/614#issuecomment-6785369308).
Branch `codex/explore-hint-scroll-614`, stacked on draft613 head
`5b9b088b273f72e8a83077bb015f676e32d32124`, full tree
`9bb88f9798359430e9923e4548c446c291c0f4c7`.

Largest-text hint content can begin before its nested scroll origin at
844×390 (row cross-axis centering) and 848×390 (column main-axis centering).
Widening the responsive query alone does not fix both. Corrected discovery
using actual bidirectional wheel input retained 1 pass / 2 failures; 832×390
is the passing control. Log SHA256
`a3287857cfbddeb231e5752d9024091fa2b1fe991abd3eab7f94e66ce60573f0`.
The original failed outer-scrollTop assumption is retained separately and is
not product evidence. Raw artifacts remain outside Git in
`/workspace/avatarrpg-env/discovery-20261111-hint/`.

Root owns only the reviewed exploration-specific flex auto-margin correction
in `hud.css`, including resets inside existing narrow/portrait and wide
Large/Largest queries. The existing Large/Largest landscape repair begins
at 52rem instead of 53rem, bridging the measured gap with its established
column/action arrangement. No new font, tap or card values; Normal is unchanged.
At short landscape widths 52–53rem and heights up to 26rem, Large/Largest
reuse zero vertical dock/action-row padding and the compact `--sp-1` HUD gap so the
full hint and action row fit the unchanged 40% dock budget after resizing.
No font, icon or tap-size reduction. At exactly 832px both existing responsive
blocks apply, so its composition
can change and requires its own visual/control check. No new font, icon, card, size, token, minimap, camera,
scene, core, content, asset, helper, existing-test, dependency or budget change.
The author owns only this handoff and new `e2e/explore-hint-scroll.spec.ts`.
All nine inherited minimap/recenter tests stay byte-identical.

The new eleven-profile regression checks actual intended hint glyphs through
real bidirectional wheel input, intersecting viewport, outer dock and every
nested clipping ancestor. Its one-CSS-pixel glyph/layout rounding allowance
comes from #492 and is fixed before correction. It records initial geometry,
clippers, scroll positions, wheel points and all observed glyphs, including a
never-seen first-fragment failure. No direct scrolling, forced input, clock or
camera substitution, font cut or ellipsis allowance. Full state/session/camera
remain unchanged while reading and through real Map, Look around and Party
open/close controls; targets must be wholly exposed and retain full tap size.

The recorded floor remains Chrome111 / iPadOS16.2. Bare safe-center is not a
floor-compatible sole repair. No newly installed engine or modern CSS.supports
result establishes that floor's acceptance. Browser-floor, physical input,
device, WebKit/Safari/PWA and owner visual gates remain open wherever unrun.

Evidence retained before final freeze:

- Original committed-probe RED: 1 pass / 2 intended glyph failures, all three
  menu outcomes and full invariants passed; log SHA256
  `55ad90c15755cc9dd1046b63a65e1968cf9959282d374701d3fc554765589a9d`.
- First candidate: 17 pass / 1 failure, including all nine inherited checks
  passing; log `db4e7cda46fa522fda584949ec2f0f3d2da0b9bd34c64fb4cdc0ea5ca5a81277`.
  At 844px two glyphs still protruded left of the scroll origin. Its original
  fixed 80px control wheel also skipped a narrow valid button alignment.
  Exact failed source, probe, config and artifacts are preserved separately.
- Corrected harness on unchanged #613 output: 1 pass / 2 intended glyph
  failures, all real controls/full invariants passed; log
  `ea160cfe3a31ca88aba195e874aca94ce34ba12f76e98b41a95ace713a9e1561`.
  The helper now derives actual wheel input from measured clip-edge intrusion,
  retaining 14 attempts, complete-target assertions, strict tap minimums and
  the predeclared one-pixel layout allowance. It records wheel points/deltas.
- Second candidate: all 18 checks passed, log
  `27abce57f3ec739cce1ff939ac01cb19ac4faca4a54e79e44a68eedd608f8446`,
  but root screenshot review rejected its narrow letter-column presentation.
  Preserve that source and evidence; it is not final visual acceptance.
  The provisional word-breaking rule is removed. Extending the existing
  Large/Largest landscape layout into the gap retains its approved type and
  control values; a new 833px boundary case supplements the retained 832,
  844, 848, portrait, tablet, Normal and inherited controls.
- Third candidate: 18 pass / 1 failure, log
  `c0c792bd77102aaed8ae5367292ef422935a2a22ab0140d919baf6db6b5ef2cb`.
  All ten new hint cases passed. The unchanged inherited Largest 844px check
  caught action bottoms below the dock after resizing back to 390px high.
  Original source/test/artifacts are preserved. The final narrow spacing
  rule keeps both hint and full action row inside the existing budget rather
  than weakening that regression. An 849px case covers the width just outside
  the compact interval; all earlier cases and assertions remain.
- Fourth candidate: 18 pass / 2 inherited failures, log
  `967ecf5da6f1fd4de6cd2dbc0d6ce7c688789a8776beaa6239f97e3e6ba9c5c0`.
  All eleven new cases passed. Both inherited Largest 844px Canvas/WebGL
  strict whole-control checks exposed the remaining action-row vertical
  padding; the earlier fit calculation had omitted its 12px. Raw geometry
  confirms a 165px scroll height. Final spacing also removes that row's
  vertical padding only inside the same bounded query, preserving horizontal
  gutter and all button padding, fonts, icons, tap sizes and the dock budget.
  Focused failed-case validation must pass before another full native run.
- Independent SOL High Standard source/harness review clears the scoped CSS
  and input repair. No assertions, deadlines or thresholds were relaxed.

Final exact-head CI, fresh CI-output native validation (new eleven plus inherited
nine), complete output identity and independent evidence review are mandatory
before public branch publication. Their exact commit/tree, results and receipts
belong in the PR and the external publication receipt, not an inferred pass in
this pre-validation handoff. Evidence root:
`/workspace/avatarrpg-env/explore-hint-scroll614/`.

Keep DRAFT. Physical input, Chrome111/iPadOS16.2, WebKit/Safari/PWA, device and
owner visual acceptance remain open wherever unrun; software Chromium coding
checks do not replace them. No Ready, merge/deploy/dispatch, install,
security/access change, art generation or paid-service action.

Keyboard feedback correction is scoped to the same compact range. Real
Tab navigation found all three 3px gold outlines clipped beyond the dock
with their original +2px offset. Native focus RED: 0 pass / 1 case failure
(three outline assertions only), stable13.863s, log SHA256
`3085aeb232f97618943bb6404b85b30644218c9259b035494d2c92fda3a90081`.
All prior hint/control/full invariants passed. An earlier overanchored grep
selected no tests; its No-tests-found failure is retained as harness evidence,
not product RED. The final scoped focus offset is -3px, placing the unchanged
3px gold ring inside the full-size button. The new test uses actual bounded
Tab input, focus-visible styles, expanded outline/all-ancestor clip geometry,
the predeclared1px layout allowance, screenshots and full invariants.

Final focused coding validation: 4/4 pass, zero skips/retries/flaky/global
errors, stable38.283s; log SHA256
`e89045be9071a0ce13cc687d379f22360b14c4c4aea8ee87cafeb99a5db3d55e`.
All actual Map/Look around/Party gold outlines remain3px/rgb(125,90,28),
now fully inside the clipped dock with the scoped inset. Root inspected
actual keyboard Map/Party screenshots. Both unchanged inherited renderer
cases, resize and full camera restore passed. Full20 on fresh exact-head CI
output remains required before public branch/PR publication.
