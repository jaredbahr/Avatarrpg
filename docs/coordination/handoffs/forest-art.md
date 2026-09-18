# Forest art checkpoint handoff

Bounded forest checkpoint accepted on integrated gameplay revision `8ce7f86`.
The approved player-view reference target is not complete. No immediate forest
regeneration is planned; continue with the existing quarry gate next.

## Preserved source

Art branch: `codex/forest-road-art` in
`C:/Users/Jared/.codex/worktrees/71bd/Avatar RPG`.

| Local source commit | Result                                                           |
| ------------------- | ---------------------------------------------------------------- |
| b480265             | Registered forest ground, exact water mask, low rubble and pines |
| 68cd1b8             | Pine depth aligned to visible trunk feet                         |
| d303525             | Authored ground composition, worn margins and quieter grass      |
| 3dd76db             | Packing-only integration of existing authored elevation material |

Gameplay preserves these commits by cherry-pick and owns projection, 96px camera,
static-rubble suppression and integration. Source work remains local; no source
PR push or merge is claimed. Keep legacy fallbacks and existing budgets.

Source provenance and exact reproduction details live in
`docs/art/forest-scene-registration.md` and `docs/art/forest-ground-composition.md`.
The water/elevation masks come from map rows. Pine footprint and depth are tested.
The final composition packer changes only the elevation-plus-0.08-cell envelope;
the west WebP and water guard remain unchanged in the final correction.

## Evidence and checks

All paths below are under this art worktree's `gallery/scene-audit/`.

- `forest-34c443e/`: invalid stale-runtime captures, explicitly labelled. Do not
  use these as candidate evidence.
- `forest-03bbd5a/`: initial registered forest, paired normal/high-contrast views,
  legal Fire Jab damage events. Sampled attack images caught launch rather than
  exact impact, so they are not audiovisual timing proof.
- `forest-composition-0c7229b/`: actual 96px comparison showing improved ground
  composition and identifying the elevation/rubble material defects.
- `elevation-packing/`: preserved before assets and enlarged boundary crops;
  pre-encoding audit confines all 15,676 changes to the approved elevation envelope.
- `forest-materials-8ce7f86/`: accepted combined material fixes, paired enemy-focus,
  southern-rubble and high-contrast views, metadata and README. Actual served
  hashes/dimensions, oblique projection, exact rubble registration, 96px camera
  and absent service-worker controller were verified. Runtime freeze released.

Source verification passed 624 tests, typecheck, lint, formatting, art validation
and asset budgets. Gameplay reports integrated verification of 692 tests plus
production build and six route/save/rubble browser checks in its handoff `5ededba`.
Maps total 2.86 MiB of 4 MiB; gameplay's fresh production precache is 15.66 MiB
of 25 MiB. No budget increase or unrelated asset degradation was used.

## Scope of acceptance

Road seams are softer and the ground less repetitive. Elevation stone now matches
the ground's brushwork; normal-view rubble is irregular low stone while high
contrast retains its cell/cover markers. These bounded changes passed review.

Remaining gaps include soft ground relative to figures/pines, footprint-shaped
needle pooling, sparse scene staging and legacy NPC/discovery icon styles.
Staged Chrome captures do not establish physical-device testing, exhaustive
occlusion, continuous motion, exact impact/audio timing or full reference quality.

Quarry gate, cutting and quarry floor continue as separate bounded batches with
exact masks, live hazards and prop interactions preserved. Agree scenery geometry,
anchors and occlusion with gameplay before generating new assets.
