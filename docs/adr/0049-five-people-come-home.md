# ADR 0049: Five people come home

**Status:** accepted engineering contract, 2026-09-25; gameplay hooks not yet implemented

Builds on ADR 0047's phase-resolved residents and ADR 0048's aggregate JavaScript budget. This is
the engineering contract for living-world Slice B on the existing Act I route: quarry, forest road
and Ba Dan. It records state and save behavior without deciding biographies, dialogue or scene
prose, which remain pending Jared's C1 and C2 decisions.

## Context

Slice A deliberately has no runtime record or placement for Bo-shan, Leto, Amri, Hesra or Senn.
Bringing them home needs persisted per-person ownership so a save cannot show one person on the
road and in Ba Dan at once. That ownership must not be reconstructed from circumstantial evidence:
map, position, flags, clock and visited nodes can all describe an interrupted or imported game but
none proves that an authored transition completed.

The existing forest-road bend is sufficient to stage the return. In Slice B it represents people
who are **freed but still returning**. Ba Dan anchors BD12-BD15 remain explicit private/off-map
homes represented by truthful contact doors; this decision does not claim that painted buildings
or new submaps exist.

## Decision

### Persist profiles and runoff in save format 5

Save format 5 adds these fields to `GameState.world`:

```ts
type ResidentProfile = 'missing' | 'returning' | 'resting' | 'recovering' | 'ready';
type RunoffState = 'unresolved' | 'inspected' | 'repaired';

residentProfiles: Readonly<Record<string, ResidentProfile>>;
runoff: RunoffState;
```

An absent resident key reads as `missing`; positions remain derived and are never saved. The five
profiles have these ownership meanings:

| Profile      | Placement ownership                                        |
| ------------ | ---------------------------------------------------------- |
| `missing`    | No visible placement or NpcDef.                            |
| `returning`  | Exactly one forest-road slot; no Ba Dan slot.              |
| `resting`    | Private home anchor only; no public actor.                 |
| `recovering` | A person-specific limited schedule.                        |
| `ready`      | An ordinary safe schedule, only where a route is authored. |

Every state change is a **later authored hook**, not a consequence of accepting the enum:

| Transition                      | Later authored completion boundary                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| absent/`missing` -> `returning` | W4 Driller-victory node explicitly assigns all five. A future liberation may use the same explicit state API, but Slice B exposes no MQ-11 route. |
| `returning` -> `resting`        | W4 forest-road west-bend arrival completion atomically assigns all five before Ba Dan exploration.                                                |
| `resting` -> `recovering`       | W5 may assign all resting profiles only when play crosses the approved first-night-to-dawn boundary, pending C2.                                  |
| `recovering` -> `ready`         | W5 may assign Bo-shan only at the approved completion of his later scene, pending C2.                                                             |
| `recovering` -> `recovering`    | W5 may record Senn's later social-scene completion without promoting him, pending C2.                                                             |

No other automatic promotion is authorized. Schema support, deserialization, reconciliation,
entering a map, moving, waiting within a day and visiting a node do not change a profile. The
resolver keeps ADR 0047's precedence; captivity and return ownership use `presence`, while
first-night and recovery ownership use `care`.

The stable Senn identity is `lw.npc.senn_messenger`, with runtime NpcDef id `senn`.
`lw.npc.senn` remains only a reserved legacy alias and cannot bind a ResidentDef. No migration
manufactures either key.

### W1 is an inert save foundation

W1 ships only the types, saved fields, defaults, format-5 schema and format-4 migration. New games
and every format-4 save receive `residentProfiles: {}` and `runoff: 'unresolved'`. W1 adds no
ResidentDef, placement, condition, story assignment, dialogue, clock promotion or other gameplay
route that writes a profile.

The format-4 migration performs no story inference. It never chooses a profile or runoff value
from `location.mapId`, `location.pos`, any flag (including `act1_complete`, `act1_lost` or
`world.ducks_seen`), `world.clock`, `story.visited`, a talk pin, return position, fired trigger or
cleared encounter. Apart from the version and required new fields, existing save data remains
unchanged. A malformed native format-5 profile fails schema validation rather than being promoted
or repaired.

An Act I loss remains terminal in shipped gameplay. A future explicit liberation hook may set the
five profiles to `returning`, but it must preserve `act1_lost`; loading or migration never performs
that transition. This contract adds no playable MQ-11 path.

### Use replaceable, art-free presentation

Slice B uses one content-data table for all five presentations. Each record selects only an
existing generic NPC sprite and `portrait.narrator`, carries `placeholder: true`, and is bound to
its stable resident id. Replacing those values later must not change resident ids, save keys,
anchors, schedules, rules or renderer behavior.

Unique models, portraits, poses, animation, handcarts, blankets, baskets, stools, tray-water props,
locomotion sheets and painted BD12-BD15 homes are **deferred: art**. The placeholder contract is
the complete presentation commitment for this slice; it creates no new asset or character-design
commitment.

### Keep the aggregate bundle gate

ADR 0048's hard gate remains **320 KB gzipped aggregate production JavaScript**, measured by
summing every shipped JavaScript chunk. Slice B targets **318.5 KB or less**, reserving at least
1.5 KB for variance and repairs. Splitting dialogue into a dynamic chunk does not avoid the
measurement. Production content stops at 318.5 KB; exceeding 320 KB requires a separate measured
ADR rather than a gate change in this slice.

## Consequences

- Per-person state owns return placement and survives save/reload without saving coordinates.
- The west bend can prove road-to-home ownership on existing maps; private/off-map anchors remain
  honest about unpainted locations.
- W1 can land without activating any resident or story transition; later waves must name and test
  each authored completion boundary.
- Act I defeat, the existing route and the unresolved runoff remain unchanged until an explicit
  authored node changes them.
- C1 and C2 still decide biographies, dialogue, recovery prose and the two proposed scene outcomes.
  This ADR contains none of those canon specifics.
- This slice commits to no new region, release, generated art or asset-manifest entry.
