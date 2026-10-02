# ADR 0070: Ship the Driller as a 2x2 unit

## Status

Accepted for review and capture. Do not merge until Jared selects the related
balance tuning.

## Context

The square-footprint rules, validation, rendering, save reconciliation and new
Driller animation sheet were delivered behind synchronized gates. The quarry
spawn at `(15,5)` and its variants and reinforcements were authored to admit the
whole square. The legacy `unit.enemy.grumbler` sheet remained live only while
the gate was off.

The new sheet's steam and debris rise above the machine. Atlas headroom correctly
measures those opaque pixels, but using their maximum as a UI anchor would make
the target cue, health bar and badges float above transient effects rather than
the machine.

## Decision

`SQUARE_FOOTPRINTS` and `SQUARE_FOOTPRINT_CONTENT_DEFAULT` are true. Size 2 is
therefore a flat-ground 2x2 in shipped rules and content validation. The constants
and injectable parameters remain temporarily so explicit compatibility tests can
exercise gate-off saves and geometry; removing that plumbing is later cleanup.

The `grumbler` enemy and its quarry world marker use `unit.enemy.driller`. The
old `unit.enemy.grumbler` atlas, files, packer, validator pins and unit-art credit
are removed. The separate Grumbler portrait, encounter and story identifiers
remain.

Both renderers consume the health-bar and badge anchors returned by
`actorSilhouetteGeometry`. The Driller manifest caps UI headroom at `0.85` tiles,
the unscaled two-tile body envelope, so transient steam and debris do not pull
the reticle or status UI upward. This cap changes presentation only; it does not
clip animation or change collision.

Enemy hit points, movement, power, defense, speed, focus, abilities, AI and XP
are unchanged. Any response to the measured win-rate increase is a separate
choice recorded outside this flip.

## Consequences

- Cover requires at least two of the Driller's four cells.
- Movement, shoves, ledges, targeting, inspection, selection, shadows and camera
  focus use the existing square-aware rules by default.
- Legacy saves reconcile a buried size-2 anchor to a legal square without moving
  valid placements unnecessarily.
- Captures must verify both renderers and projections, especially the UI cap
  during cast steam/debris and the held knockout facing in both directions.
- This review branch remains unmerged until Jared chooses the tuning.
