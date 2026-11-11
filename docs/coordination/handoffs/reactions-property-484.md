# Terrain forecast property (#484)

Owner: Codex, branch `codex/reactions-property-484`, from main
`1c273d2a004456679d3cdb5949773b5e864eaeff`.
The [live claim](https://github.com/jaredbahr/Avatarrpg/issues/484#issuecomment-6718309062)
records scope, source identities, validation results and publication status.

The intended regression checks the real terrain forecast against real reducer
commands on seeded boards with surfaces and props. Aggregated reaction counts
alone cannot establish that the same cells changed. Test-only forwarding
observation must read the forecast's actual throwaway draft and journals rather
than implement another version of the terrain rules.

The initial write scope is a new property test and this handoff. Production
rules, content, existing tests, dependencies and assets remain read-only. Any
concrete mismatch requiring a production fix needs a recorded reproduction,
ownership check and claim amendment before source edits.

The current corpus enumerates 56 abilities with damage, surface, push, pull,
dash or wall effects. Nine samples each produce 504 real legal commands. The
generator uses seeded flat 8×8 boards, cycles the four encounter/map identities,
samples all seven surface definitions and places all six prop definitions using
the normal draft methods. These are generated boards, not authored-map route
playthroughs. Fixture-only ability grants, one-million HP and 100 AP isolate an
immediate, nonlethal action. Original ability and prop definitions, hit rolls
and chance effects remain unchanged. Every case must prove that its command
was accepted and no death or turn upkeep occurred.

A forwarding constructor observer retains the actual outer forecast draft and
the real reducer draft without replacing their methods. It restores in `finally`.
The oracle compares complete grid cells, props, temporary walls, ordered surface
events and per-cell reaction journals. Public entries must match actual reaction
IDs, counts, kinds and first-change surface metadata; public prop outcomes must
match the real result, including HP, positions, destruction, ignition, dousing,
movement, cover removal and break text. Actual prop events must have a unique
public row. Controls deliberately swap cells, change prop HP and a reaction ID,
and corrupt public kind, surface, label and ignition metadata.

Three legal empty-area actions initially failed the observer's assumption that
every forecast creates a draft. Their source and failures are preserved. The
test now requires the exact empty public result and zero affected cells before
using an unchanged-world prediction, then still runs and compares the real
command. All 504 cases remain. No production forecast defect was established.

The property does not assert equality of conditional unit damage/status
outcomes or cover lethal and turn-upkeep horizons. Those boundaries are explicit
generator constraints, not mismatches skipped after comparison. It checks the
world outcomes of real commands, including missed unit attacks, because terrain
and prop impact occurs on both hits and misses.

Acceptance requires at least 500 deterministic legal cases, automatic coverage
of world-touching content abilities, per-cell terrain and prop outcomes, reaction
kinds, meaningful mutation controls and an explicit whole-workload bound below
20 seconds. Conditional unit damage/chance outcomes and reducer turn-upkeep
boundaries must be represented honestly; mismatches cannot be silently skipped.

Receipts and any diagnostic failures remain outside Git under
`/workspace/avatarrpg-env/reactions-property484/`. The claim and draft PR record
the exact clean final-head `npm run ci:local` and actual hosted jobs, including
skips. Keep the PR draft; no merge or deployment. Test-only coverage does not
establish rendered or physical-device acceptance. A player-facing correction
would require its own relevant native validation before publication.
