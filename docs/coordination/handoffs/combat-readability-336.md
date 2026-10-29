# Combat readability — issue #336

## Scope

On `codex/fix-336-combat-readability`, based on `7d6a5515`, improve zoom-1
combat health bars and the acting-unit cue while keeping Canvas and Pixi aligned.
Compact only the default-text initiative strip in desktop/landscape layouts;
portrait layout rules remain separate.

## Implementation

- Shared `combatActorSilhouetteGeometry` in `src/render/geometry/actorSilhouette.ts`
  supplies both renderers and camera-framing callers with 36×8 logical
  world-pixel minimum combat bars and a shared pixel size. Canvas passes the
  camera scale because its actor geometry is in screen CSS coordinates; Pixi
  passes one in logical world pixels.
- Both backends draw the bar as a snapped one-world-pixel ink frame, inset
  track/fill and one-pixel upper highlight. Health fraction, faction fill and
  faction cap remain the health/side indicators.
- The acting unit keeps its under-foot cue location. A shared snapped polygon
  pair replaces the thin ellipse with a 3-world-pixel angular ink keyline and
  a 1-world-pixel gold inner stroke; terrain remains visible inside the frame.
  It is static, so reduced motion needs no special path; a cleared
  `activeUnitId` draws no acting cue.
- `src/styles/hud.css` adds only a landscape-wide, default-text rule for
  `.turn-strip` and `.turn-chip`. Chips stay touch height, labels keep their
  accessible names and crowded orders scroll horizontally.
- The focused E2E writes ignored review captures of full party bars and a damaged active
  enemy, then records 1280×800 and 1180×820 views on both backends under
  `.shots/combat-readability/`, including full-page desktop views with the
  compact initiative strip.

## Validation

- `npm run typecheck` — passed.
- Focused ESLint over changed TypeScript and E2E files — passed.
- Prettier check over changed source, CSS, E2E, and handoff files — passed.
- `npm exec vitest -- run src/render/geometry/actorSilhouette.test.ts` — 29
  tests passed.
- Focused `combat-readability.spec.ts` — both Canvas and software-WebGL cases
  passed at desktop and landscape-tablet sizes, including zoom-1 camera and
  strip geometry assertions (2 tests, about 2.6 minutes).
- Production build passed before the final hollow-cue adjustment; final
  typecheck and focused tests passed after it.

The ignored captures are visual evidence for root review, not acceptance by
the implementation owner. The full project gate and combined review remain
with the integration owner.
