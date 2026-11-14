/**
 * Followers (#696): someone who is not in the party but walks with it.
 *
 * A follower is presentation only. The rules never hear of it: it is not a
 * unit, it never blocks a step or a tap, and nothing about it is saved. The
 * exploration scene adds each follower whose `when` holds to the end of the
 * party's line, so it trails the last member a tile or two behind along the
 * leader's path and steps aside exactly as the party does. Because `when` is
 * read from the story's own flags and visit log, a loaded save puts him back
 * without a field of its own.
 */

import type { Condition, Vec2 } from '../../core/types';

/** A tile a follower is staged on instead of walking in the line, while `when` holds on `mapId`. */
export interface FollowerStation {
  readonly when: Condition;
  readonly mapId: string;
  readonly pos: Vec2;
}

export interface FollowerDef {
  /** The figure's id on the animator's clock; never a party member's id. */
  readonly id: string;
  readonly name: string;
  readonly sprite: string;
  readonly when: Condition;
  /** First match wins; without one the follower walks in the line. */
  readonly stations?: readonly FollowerStation[];
}

const visited = (nodeId: string): Condition => ({ kind: 'visited', nodeId });
const unvisited = (nodeId: string): Condition => ({ kind: 'not', of: visited(nodeId) });

/**
 * Ruon stands with the party from his surrender at the gate until the table
 * decides what happens to him: the vote, and whichever answer follows it (Jin
 * takes him away in `trade_chosen`; he says "Ba Dan, then" in `escort_chosen`).
 */
const RUON_AT_THE_GATE: Condition = {
  kind: 'all',
  of: [
    visited('ruon_surrender'),
    unvisited('gate_escort_explore'),
    unvisited('gate_trade_explore'),
  ],
};

/**
 * On the escort route he walks with the party to Ba Dan and stands with it in
 * the welcome-home crowd. The one gap is the Cutting after the ambush, where
 * #628 stages him at his own post ("I'll keep to the back") until the party has
 * beaten the Driller; he walks down the hill beside them from there.
 */
const RUON_ESCORTED: Condition = {
  kind: 'all',
  of: [
    { kind: 'flag', key: 'ruon_spared', op: 'set' },
    unvisited('demo_complete'),
    { kind: 'any', of: [unvisited('after_ambush'), visited('act1_victory')] },
  ],
};

/**
 * In Ba Dan he stands with the freed workers at the east-road mouth (#628's
 * welcomers, `returnees.ts`) from the party's arrival until the welcome home has
 * played: on the verge beside Bo-shan, in view of the street the party walks in
 * on, where the families can ask him their questions.
 */
const WELCOME_CROWD: FollowerStation = {
  when: {
    kind: 'all',
    of: [visited('forest_return_arrival'), unvisited('demo_complete')],
  },
  mapId: 'ba_dan_village',
  pos: { x: 22, y: 6 },
};

export const FOLLOWERS: readonly FollowerDef[] = [
  {
    id: 'follower.ruon',
    name: 'Captain Ruon',
    sprite: 'unit.ally.ruon',
    when: { kind: 'any', of: [RUON_AT_THE_GATE, RUON_ESCORTED] },
    stations: [WELCOME_CROWD],
  },
];
