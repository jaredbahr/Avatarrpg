# Modular route follow-up

Root owns `codex/modular-route-followup`, based on release candidate `b809b04`.
PR64 remains fixed at that revision while CI run `35450833856` completes;
do not push this follow-up onto its branch or restart that run.

## Integrated for local review

- Forest route source `d572d58` / `b344702`, integrated as `79f23fb` / `5166c41`:
  local material region, feathered shoulders, independent existing pines/rubble,
  runtime water. Only the two unused shipped full-map forest ground pages were
  removed; history and source provenance remain available. This checkpoint passed
  860 tests and all source checks. The material appearance still needs correction.
- Dry pond bank source `fb4288c`, integrated as `7f9bd00`: source-art bank outside
  the eight actual water cells, transparent water interior, bounded dry margin.
  Source mask tests and asset validation pass; map family is 3.87 MiB / 4 MiB.
- Compact initiative source `bd5b853`, integrated as `f56cdc9`: normal-text short
  landscape only, in-flow portrait/label chips. Same-state playable captures show
  31.70 pixels more battlefield height with the action dock present and 50.39px
  chip heights. See the [HUD handoff](hud-compact-prototype.md).

## Ownership and remaining review

Terra's forest implementation and Luna's HUD implementation are complete and
their previews stopped. Root owns integration, combined picking/gesture checks
and gameplay review. Astra's `forest_material_art` owns one compatible material
sheet correction in its isolated tree, using the old painting only as a style
reference. Root/Terra will handle packing and any reusable grass regions needed
outside the current road envelope. No map geometry or water rules change.

The current forest prototype is not ready to ship: exposed procedural shoulders
and material consistency remain visual gaps. The pond retains its real cross
footprint. Full route composition, motion, listening and physical-device review
remain open. This work does not establish completion of the approved target.
