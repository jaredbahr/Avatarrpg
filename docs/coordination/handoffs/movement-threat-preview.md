# Movement threat confirmation handoff

- **Scope:** The movement confirm bar now reports possible direct attacks for
  the selected destination. It shows `X could hit here.` when the reviewed
  geometry query finds a witness, and always labels the result as based on the
  current battlefield because later actions and hazards can change it. An
  empty query says `No immediate direct attack found`; it never calls a tile
  safe. Move cost, remaining move, confirmation, cancel, keyboard, and touch
  flows remain unchanged.
- **Source contracts:** Integrated the pure helper from `6d101a0` and the
  explicit-budget adapter from `9a3c7f8`. The diagnostic commit `22746fa` was
  not imported. The helper only considers one ordinary movement followed by
  one currently eligible direct attack; it does not promise damage, intent,
  reaction chains, multiple casts, or movement contact survival. The adapter
  uses `startingAp`, cooldown expiry, status expiry, and current battlefield
  identity for its cache.
- **Implementation:** `CombatScene` owns one cached
  `createMovementThreatQuery` instance and queries it only while rendering a
  valid movement confirmation. The selected tile is passed as the projected
  defender destination, so enemy routes use the actual proposed occupancy.
  Only the lower confirmation branch changed; camera methods and movement
  rules remain outside this work.
- **Files:** `src/core/rules/directAttackThreats.ts` and its tests,
  `src/app/ui/movementThreats.ts` and its tests,
  `src/app/scenes/CombatScene.ts`, `e2e/combat-preview.spec.ts`, and this
  handoff.
- **Validation:** Focused helper/adapter tests pass: 17 tests. Installed
  Chrome touch checks pass at the normal viewport and at `390x844` with huge
  text: the gate cover destination warns about the Fire Nation Deserter, the
  preceding tile shows the neutral empty result, and the qualifier remains
  visible. Run `npm run verify` on the final checked head before integration.
- **Coordination:** This branch is based on accepted combat-preview head
  `3064e7c`, with the frozen PR64 candidate untouched. No art, map, navigation,
  balance, camera, save, or release files were changed. The pending-AP work is
  owned by the separate audit task; this adapter continues to call shared
  `startingAp` so that fix flows through without a UI API change.
