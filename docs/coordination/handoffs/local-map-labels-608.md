# Local map label scale — #608

Owner/session: `root/local-map-labels608-20261111`.
Branch: `codex/local-map-labels-608`.
Base: canonical main `45544749646ffb183205aaf2717762bba599fa45`,
tree `68c64c89eaceb56c79eed69c8b795a3fc528754e`.
Claim: https://github.com/jaredbahr/Avatarrpg/issues/608#issuecomment-6783242563.

The Local map's names became tall overlapping glyphs: the root token's nonzero
unitless `0.65` is invalid as a CSS font-size, so the SVG inherits an interface
font size in map coordinates. The existing token comment already specifies map
user units. Add only the missing CSS length unit, preserving numeric 0.65; in SVG
`px` resolves in the local coordinate system and then scales through its CTM.
The separate unitless stroke-width is valid SVG syntax and stays unchanged.

The root found this by inspecting a full rendered Local-map screenshot after a
three-case functional discovery pass. Those functional passes were not visual
acceptance. Existing local-map coverage checks horizontal bounds but misses glyph
height and vertical containment. Original discovery evidence is retained outside
Git at `/workspace/avatarrpg-env/discovery-20261111-ui/`, clean producer
`5cdaae99714a4d98c66578040476b9cc9e2bcb8c`, tree95e37. Relevant UI/map/CSS source
matches main455; that producer includes the unrelated Settings arrow fix and
older unused T8 art. No whole-tree equivalence is claimed.

Final scope: one root font-size token in `src/styles/base.css`, one new scoped
`.dialog .local-map` flex rule in `src/styles/hud.css`, the NEW typography browser
regression and this handoff. All 15 open PR file scopes were checked. Merged
PR540 belongs to this goal and only claimed the unrelated `.tap-tooltip` rule;
merged PR515/364 are this goal's different setup/reward/staged-dialogue and
combat-header hunks. The same issue claim was amended and read back before the
HUD rule. #488 contains a coordination request, not a competing file claim.
No other HUD selector, LocalMap, App, Dialog, camera, renderer, core, story,
asset, helper, package or workflow edit. No visual redesign or asset generation/
replacement. The initial token-only and amended layout results are retained below.

Before correction, run new native RED typography tests across Normal/Large/
Largest and tablet/compact viewports. Use actual Settings and Map controls,
nonempty expected NPC labels, valid CSS size syntax and independent positive
glyph dimensions, map-cell-scale height, and all-axis viewBox containment
including half the stroke. Use SVG geometry/CTM, not its letterboxed client-box
ratio. Capture state/session/RNG/camera after changing text size and settling the
layout; opening/closing Map must preserve them. A separate actual objective-route
control reaches Mira and advances her dialogue. No injected CSS, copied golden,
teleport, outcome, clock or camera substitution.

Root inspects all six before/after screenshots; geometry is not physical-device
legibility acceptance. Retain every original failure and exact source/probe/
configuration/producer/output identities. Keep existing tests and budgets intact.
Freeze reviewed clean final source before exact-head `npm run ci:local`; pass
every gate before branch publication. Run final native against the fresh CI build,
verify all output paths/bytes/hashes and obtain independent evidence review before
a DRAFT. Inspect actual hosted leaf jobs including skips. Physical input,
WebKit/Safari/PWA, device and owner visual acceptance remain open.

Current-main preparation streamed the approved public archive, verified the full
Git tree and signed commit, and reused only identical binary inputs read-only.
Every editable text file is independent. No software was installed; all raw
evidence and previous candidates remain. Evidence root:
`/workspace/avatarrpg-env/local-map-labels608/`.

## Retained first correction and bounded scope amendment

Original native RED was 6 fail / 1 pass, stable 87.439s; all six cases failed only
font validity, cell-relative glyph height and painted bounds. State/session/camera
and route controls passed. Log:
`109dc32537cc039cc0f383c5fa5218e83f88ce214ed1d69d3409356fa8e8d0d0`.
The token-only correction was 6 pass / 1 fail, stable 64.774s, log:
`5e643711a78418183569dc62b790dedc1581208e6fe5d7253968ef661785a739`.
Compact Largest still collapsed the entire SVG to a hairline (CTM cell height
0.03385px). Its actual screenshot proves a product layout failure, not a reason
to weaken the original strict glyph/bounds tests. Every other profile and the
state/camera/route controls passed. Both reports, source versions and raw media
remain separate; the earlier seven-case probe is preserved outside Git.

The same claim was amended and read back before extending scope to ONLY a new
`.dialog .local-map` nonshrinking-flex rule in `hud.css`. The existing scrollable
dialog body handles the route controls; SVG width, intrinsic aspect and maximum
height remain. The HUD minimap is outside this selector. Merged PR515/364 are this
goal's own different setup/reward/staged-dialogue and combat-header hunks; no live
open PR claims this map selector. #488's coordination request is not a file claim.
No other HUD selector, global stack/dialog, scene, helper or layout redesign.

The strengthened probe retains every original strict label assertion and adds a
natural-height guard: content width times viewBox aspect, capped by the existing
computed maximum, within one device pixel of layout rounding. It also uses real
wheel input to expose every complete route/Close control and hit-test its centre.
Full state/session/camera must remain unchanged while reading and scrolling.
Capture a focused compact-Largest RED on the token-only build before adding the
nonshrinking rule; then validate the complete matrix and inspect all six captures.

Focused noncollapse RED: 1 fail / 0 pass, stable 14.725s, log
`14d9990139c3d9cee9cf00ca37aa290a5c7d99d0bad675fd6c434a9e213356fe`.
The existing strict glyph/bounds failures and added natural-height guard all
failed; source/test identities and screenshot remain. Then the narrowly scoped
nonshrinking rule passed the complete strengthened matrix: 7/7, zero skips,
retries, flaky cases or errors, stable 66.433s, log
`9a0bc843465c629527ed5dd4ed57f15b1969197e9b9a2c7c5fab6d272da64c10`.
Glyphs are 0.84–0.90 map units high. Compact Largest SVG height is 202.140625px
against its 202.153846px intrinsic expectation, replacing the hairline. All
state/session/RNG/camera and actual route/scroll/hit-test controls pass. Root
inspected all six full viewport screenshots and the compact-Largest scrolled
controls. Compact labels remain small at the existing intended map scale; these
coding checks are not owner/physical-device legibility approval. The HUD minimap
is unchanged. No original assertion, font numeric value or budget was relaxed.

These working-build passes are preliminary. Final publication still requires
reviewed clean final-head full CI and native on its fresh production output,
complete output identity and independent final evidence review.
