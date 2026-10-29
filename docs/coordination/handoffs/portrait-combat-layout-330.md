# Portrait combat layout — #330

Branch: `codex/330-portrait-combat-layout-cloud`  
Base: `bc77ae2eceb6740dd4c143cae61595a1f4884bc2`  
Scope: combat-specific portrait-tablet CSS plus a new layout E2E spec. No scene
logic, shared HUD rules, combat card rules, or existing tests/helpers changed.

## Implementation

- At portrait widths 36–55rem, fold View/help under the existing More control,
  keep title/Pause/More on one line and let the menu overlay the board. The
  existing More handler retains focus hand-back and `[data-toast-clear]` behavior.
- Compact the portrait initiative ribbon and keep the acting card at its own
  content height. The dock has a bounded, scrollable 32dvh cap; confirmation
  controls remain reachable by scrolling. Landscape controls remain inline.
- Added `e2e/combat-portrait-layout.spec.ts`: iPad portrait normal/Largest
  confirmation geometry and tap targets, More focus/toast/resize behavior, and
  landscape iPad/Surface inline controls. Browser assertions are authored but
  not yet run; do not report the 55% board target as verified until then.

## Checks and remaining gates

- `npm run typecheck` — passed.
- Targeted ESLint for the new E2E file — passed (CSS has no ESLint config).
- Prettier on both changed files and `git diff --check` — passed.
- Browser/WebKit and full CI/build remain queued for the controller's
  serialized validation slot. No commit was made.
