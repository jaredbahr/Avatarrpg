# Pending support AP

## Scope and ownership

Branch `codex/pending-support-ap`, isolated worktree `Avatar RPG-pending-support-ap`,
based on accepted combat-preview checkpoint `3064e7c`. No release checkout,
CombatScene, movement-warning UI, kit, map, encounter or balance edits.
The lead owns integration; combat-preview owns its subsequent UI wiring.

## Result

Off-turn AP grants now wait in `Unit.pendingAp` for the recipient's next
activation; current-unit grants remain immediate. `startingAp` applies the
existing total cap to base/status AP, banked AP and pending bonus. Both carry
fields clear at activation, including a skipped turn, and pending bonuses clear
at battle creation, result absorption and revival. Missing `pendingAp` in old
v3 saves defaults to zero; new mid-battle saves preserve it.

See [ADR 0031](../../adr/0031-pending-support-ap.md). The existing movement-threat
adapter uses `startingAp` and needs no formula change. Inform its UI owner of
this dependency when integrating the branches.

## Evidence

Read-only baseline reproduction used legal level-7 Nima/Jinu Air Shaping kits,
seed `ally-ap-proof`, gate starting positions, Air Cushion then End Turn:
Jinu AP 4 -> 5 -> 4. Serialization preserved 5 before the loss. These advanced
kits were diagnostic setup, not an expansion of the shipped route.

Nine focused tests now cover Air Cushion before/after the recipient's previous
turn, real Pressure Points refund, stacking/cap, coexistence with banked AP,
Frozen/Stunned skips, legacy-v3 loading, exact round-trip and battle transitions.
Full `npm run verify` passed typecheck, lint, formatting and 707 tests in 74
files on the final implementation. This final evidence-only handoff update was
formatting-checked separately. No PR or CI run.
