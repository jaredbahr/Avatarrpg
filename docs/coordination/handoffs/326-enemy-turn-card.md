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

- Source checkpoint: `197162e22e9f1328b5474efd831ebea049fee098`, based on
  `bc77ae2eceb6740dd4c143cae61595a1f4884bc2`. Implementation ran on Luna High,
  followed by independent orchestration review and lifecycle refinements.
- `npm ci --no-audit --no-fund` passed using a writable temporary cache;
  no lockfile or dependency changes were needed.
- Focused tests passed: 27 tests covering enemy/ally cards without controls,
  single turn announcements, targeted toast expiry/dismissal/eviction,
  turn-change/unmount cleanup, and suppressed-confirmation safety.
- Full `npm run ci:local` passed all nine stages on source checkpoint
  `197162e22e9f1328b5474efd831ebea049fee098` on 2026-10-29: typecheck, lint,
  formatting, 3009 tests in 258 files, build, bundle budget, art validation,
  asset budget and balance. Local Node was 24.22.1; CI pins Node 22.
- This handoff update is documentation-only after that full run; formatting
  and diff checks cover it, not a claim of another full exact-head run.
- Browser, accessibility, camera/pinch reflow, Largest-text and visual acceptance
  remain unverified. In particular, `combat-pan-reflow.spec.ts` and
  `hud-large-text.spec.ts` still need execution. Physical-device testing is also
  not established. Skipped PR browser/gallery suites are not acceptance evidence.
- Publish as a draft for later review only. No readiness, auto-merge, merge,
  release bump or deployment is claimed. New remote commit checks remain required.
- Preserve separately owned #331 action-header and #332 prop-label changes when
  integrating; this change does not rewrite either section or alter pacing/art.
