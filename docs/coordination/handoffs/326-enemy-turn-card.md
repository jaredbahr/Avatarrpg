# #326 enemy-turn card handoff

## Scope and implementation

On branch `codex/326-enemy-turn-card-cloud`, replace the non-party moving banner
with a compact bottom-dock portrait/name card. Enemy turns read “Name is
acting”; ally turns read “Ally turn · Name is acting.” The card is marked
`aria-hidden`; `CombatScene.sync()` announces the same actor-specific copy once
per active-unit change through the shared live region. Non-party turns render no action
bar, move prompt, or choose-action copy. The dock now contracts around the card
and relies on the existing post-HUD camera/resize path.

Toast `show()` now returns a unique handle (or `null` for a suppressed/empty
toast); `dismiss(handle)` removes only that toast and cancels its dismissal and
fade timers. An optional dismissal callback lets an owner release related state
when its toast expires, is manually dismissed, cleared, or evicted by the
four-toast cap. The remaining-AP confirmation uses this callback to cancel its
4-second timer and disarm stale state as soon as the toast disappears. It is
also canceled on active-unit change or scene unmount; if duplicate suppression
returns no handle, the confirmation does not arm.

## Changed files

- `src/app/scenes/CombatScene.ts`
- `src/styles/hud.css`
- `src/app/ui/Toasts.ts`
- `src/app/scenes/CombatScene.test.ts`
- `src/app/scenes/CombatSceneHud.test.ts`
- `src/app/ui/Toasts.test.ts`
- `e2e/day-phase.spec.ts` (return the new toast handle from its existing spy)

## Verification and remaining gates

- `npm ci --no-audit --no-fund` passed with cache set to `/tmp/avatar326-npm-cache`.
  The default cache attempt failed because `/home/agent/.npm` is unavailable;
  no repo files or lockfiles were changed by installation.
- Focused Vitest: `src/app/ui/Toasts.test.ts`,
  `src/app/scenes/CombatScene.test.ts` and `CombatSceneHud.test.ts` passed (26
  tests at `2026-10-29 05:33 UTC`). Coverage includes repeated-turn sync
  announcing once, turn-change AP cleanup, enemy/ally card DOM without actions or
  Move/choice text, toast expiry, fade dismissal, clear and stack eviction.
- `npm run typecheck`, focused ESLint, and Prettier checks passed after that
  test run; rerun them after any subsequent edits.
- Full `ci:local`, browser/accessibility and visual review have not been run.
  Request the serialized heavy-check slot before full CI/build/browser checks;
  those gates remain required before publication. No push, PR, release bump,
  merge or deployment is performed from this checkpoint.
