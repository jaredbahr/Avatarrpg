# ADR 0017: Connect the Act 1 places

Status: accepted, 2026-09-17. First playable slice of ADR 0011.

## Decision

Ba Dan, Forest Road, Quarry Gate, The Cutting and Quarry Floor are connected
places. Maps own directed, named exits with explicit arrival tiles and conditions.
The party can backtrack before committing to the final encounter. A null story
cursor is legal while exploring. The riverside's existing invitation and return
route remain available.

Map triggers own walk-over story events. The reducer checks every tile of a
route, stopping at the first active trigger; clicking an NPC uses the same walk.
Each trigger has a visible representative and a named area. Act 1 fights remain
in their existing story nodes, preserving dialogue, outcomes, exact encounter
levels, and XP. A once-trigger is recorded before entering its node. Conditions
also consult visited story nodes so saves made before triggers existed do not
replay encounters. Winning records the encounter in world memory; losing retains
the existing fail-forward story and compensating XP.

World state records return positions, fired triggers and cleared encounters.
Save format 3 explicitly migrates format 2 with empty world memory while keeping
visited story nodes and all party/battle fields. Cross-map links arrive beside the
reciprocal exit; dialogue returns use remembered valid positions. Map transitions
autosave. The departing scene finishes its walk against the old map before the
new map fits its camera. Both renderers draw every exit.

Optional conversations on the forest verge and at the workers' tea stop reward
exploration with persistent discoveries and changed return dialogue. They award
no XP, so optional visits cannot break the current progression contract.

## Scope and validation

This is one connected region, not the full Phase W model. Ordered Act 1 encounter
access remains conditional on the preceding story resolution. The existing
exhaustive story progression test remains intact; world tests additionally walk
all six choice combinations through actual exits, triggers, discoveries and
return trips and assert encounter arrival levels and no repeated rewards.

The legacy single exit remains supported for riverside and old fixtures. The
new exits and triggers are additive content fields; map geometry, battle rosters,
combat scaling and art budgets are unchanged. Browser tests cover both renderers,
animated crossing, return trips and encounter transitions; the gallery includes
a forest exploration view in landscape and portrait.

Later slices can add direct world-owned encounters, independently roaming enemy
groups, region level bands and a quest journal. This slice does not claim those
features or change the ±2 scaling policy before region content requires it.
