# Combat readability — issue #336

## Scope and review base

`codex/fix-336-combat-readability-standalone` is a review branch stacked on the
#322 draft source `3c305155` (`codex/322-bending-lifetime-draft`). Its source
diff against that parent contains only #336 health bars, acting cues, initiative
styles, scoped tests, and this handoff. The draft PR must target the #322 branch
until that parent lands; retargeting to main is a separate integration gate.

## Behavior

- Shared `combatActorSilhouetteGeometry` sizes combat bars from a 36×8 logical
  world-pixel floor at actor scale one. The width floor grows with actor scale
  before whole-pixel snapping. Canvas passes the camera scale because its actor
  geometry is in CSS coordinates; Pixi passes one world pixel. The one-pixel
  frame and highlight leave a filled track at least four world pixels high at
  zoom one.
- Both backends quantize damaged fill width to whole world pixels. A 7/13 HP
  enemy thus has the same sharp 18-pixel fill in a 36-pixel bar on Canvas and
  WebGL. The faction cap and fill length still distinguish side and damage.
- The acting unit keeps a static, under-foot angular cue. Shared geometry emits
  filled, integer world-pixel runs for the ink and gold outlines; Canvas and
  Pixi fill rectangles, so neither draws antialiased diagonal strokes. High
  Contrast widens the ink outline from three to four world pixels. Reduced
  Motion has no moving cue path.
- At Normal text, the six-chip desktop initiative strip is one row no taller
  than 3.75rem, with each chip at least `var(--tap)` tall. On an upright iPad at
  Largest text, names may wrap within their chips instead of being ellipsized.

## Verification state

The scoped geometry test covers actor-scale width, world-pixel height, filled
cue runs, Canvas/Pixi coordinate-scale parity, a hollow centre, and the stronger
High Contrast outline. The focused test, TypeScript, scoped ESLint, Prettier,
and `git diff --check` passed on the acting-cue amendment before its commit.
The browser spec checks 1280×800 desktop and 834×1194 iPad portrait on Canvas
and WebGL, including Normal strip geometry, Largest names, reduced-motion and
High Contrast captures, and an actual painted-pixel comparison at 7/13 HP.
Those browser assertions and before/after screenshot evidence are **pending**
the dedicated browser gate; the previous mixed branch's landscape captures
are not acceptance evidence for this standalone source.

The exact committed head still needs its scoped static checks, all required
pre-push gates, and one branch CI dispatch before a draft PR is published.
No full-project gate or browser acceptance is claimed here.
