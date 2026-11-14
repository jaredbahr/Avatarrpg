import { describe, expect, it } from 'vitest';
import { ASSETS, CONTENT, CHARACTERS } from '../../content';
import { FOLLOWERS } from '../../content/story/followers';
import { createGame } from '../../core/state/createGame';
import { visibleNpcs } from '../../core/story/world';
import { buildGrid, tileAt } from '../../core/rules/grid';
import type { Condition, GameState } from '../../core/types';
import { activeFollowers, followerPose, lineIds, placeFollowers } from './followers';
import { TOPDOWN_SHEETS } from '../../content/assets/topdownSheets';

function game(): GameState {
  return createGame(CONTENT, {
    seed: 'followers-696',
    party: [{ characterId: 'kaya' }, { characterId: 'sura' }, { characterId: 'bo' }],
    startNode: 'village_explore',
  });
}

/** A table that has walked these nodes in order, standing on the last, with these flags. */
function walked(base: GameState, nodes: readonly string[], flags: GameState['flags']): GameState {
  return {
    ...base,
    flags: { ...base.flags, ...flags },
    story: { ...base.story, nodeId: nodes.at(-1) ?? null, visited: [...nodes] },
  };
}

const FIGHT_TO_CHOICE = [
  'forest_after_explore',
  'gate_parley',
  'battle_quarry_gate',
  'ruon_surrender',
  'ruon_choice',
];
const TO_THE_DRILLER = [
  'cutting_after_explore',
  'quarry_descent',
  'quarry_assessment',
  'battle_grumbler',
];
const WALK_HOME = [
  'act1_victory',
  'act1_epilogue',
  'act1_evening',
  'quarry_after_explore',
  'cutting_return_explore',
  'gate_return_explore',
  'forest_return_explore',
  'forest_return_arrival',
  'forest_return_arrived',
  'village_return_explore',
  'welcome_home_mira',
  'welcome_home_gao',
  'welcome_home_dorin',
];
const ESCORT = [
  ...FIGHT_TO_CHOICE,
  'escort_chosen',
  'gate_escort_explore',
  'cutting_explore',
  'battle_ambush',
  'after_ambush',
  ...TO_THE_DRILLER,
  ...WALK_HOME,
  'demo_complete',
];
const TRADE = [
  ...FIGHT_TO_CHOICE,
  'trade_payment',
  'trade_chosen',
  'gate_trade_explore',
  ...TO_THE_DRILLER,
  ...WALK_HOME,
  'demo_complete',
];

/** Whether Ruon walks with the party at each node of a route. */
function ruonAlong(route: readonly string[], flags: GameState['flags']): Record<string, boolean> {
  const base = game();
  return Object.fromEntries(
    route.map((node, index) => {
      // The vote's flag is set as the table leaves `ruon_choice`.
      const chosen = index > route.indexOf('ruon_choice') ? flags : {};
      const state = walked(base, route.slice(0, index + 1), chosen);
      return [node, activeFollowers(state).some((who) => who.id === 'follower.ruon')];
    }),
  );
}

describe('followers (#696)', () => {
  it('are drawable figures whose ids never clash with a party member', () => {
    const characters = new Set(CHARACTERS.map((character) => character.id));
    for (const follower of FOLLOWERS) {
      expect(ASSETS[follower.sprite]?.kind).toBe('sheet');
      expect(characters.has(follower.id)).toBe(false);
    }
    expect(new Set(FOLLOWERS.map((follower) => follower.id)).size).toBe(FOLLOWERS.length);
  });

  it('read only story nodes that exist', () => {
    const nodes = (condition: Condition): string[] =>
      condition.kind === 'visited'
        ? [condition.nodeId]
        : condition.kind === 'all' || condition.kind === 'any'
          ? condition.of.flatMap(nodes)
          : condition.kind === 'not'
            ? nodes(condition.of)
            : [];
    for (const follower of FOLLOWERS)
      for (const condition of [follower.when, ...(follower.poses ?? []).map((pose) => pose.when)])
        for (const node of nodes(condition)) expect(CONTENT.story.has(node), node).toBe(true);
  });

  it('puts Ruon on the end of the line, after every party member', () => {
    const state = walked(game(), FIGHT_TO_CHOICE, {});
    expect(lineIds(state, activeFollowers(state))).toEqual([
      ...state.party.map((member) => member.id),
      'follower.ruon',
    ]);
  });

  it('walks Ruon from his surrender to the welcome home on the escort route', () => {
    const along = ruonAlong(ESCORT, { ruon_spared: true });
    expect(along).toEqual({
      forest_after_explore: false,
      gate_parley: false,
      battle_quarry_gate: false,
      // He stands with the party while he surrenders and the table votes.
      ruon_surrender: true,
      ruon_choice: true,
      escort_chosen: true,
      gate_escort_explore: true,
      cutting_explore: true,
      battle_ambush: true,
      // In the Cutting after the ambush #628 stages him at his own post.
      after_ambush: false,
      cutting_after_explore: false,
      quarry_descent: false,
      quarry_assessment: false,
      battle_grumbler: false,
      // He walks down the hill beside them, into the welcome-home crowd.
      act1_victory: true,
      act1_epilogue: true,
      act1_evening: true,
      quarry_after_explore: true,
      cutting_return_explore: true,
      gate_return_explore: true,
      forest_return_explore: true,
      forest_return_arrival: true,
      forest_return_arrived: true,
      village_return_explore: true,
      welcome_home_mira: true,
      welcome_home_gao: true,
      welcome_home_dorin: true,
      demo_complete: false,
    });
  });

  it('lets Jin take Ruon on the trade route: he never follows the party', () => {
    const along = ruonAlong(TRADE, { ruon_traded: true });
    expect(Object.entries(along).filter(([, here]) => here)).toEqual([
      ['ruon_surrender', true],
      ['ruon_choice', true],
      ['trade_payment', true],
      // He is still there while Jin says "Captain. Hands where I can see them."
      ['trade_chosen', true],
    ]);
  });

  it('stands Ruon with the freed workers in Ba Dan until the welcome home has played', () => {
    const base = game();
    const at = (mapId: string, nodes: readonly string[]) =>
      placeFollowers({
        ...walked(base, nodes, { ruon_spared: true }),
        location: { mapId, pos: { x: 22, y: 7 } },
      });
    const arrived = WALK_HOME.slice(0, WALK_HOME.indexOf('forest_return_arrival') + 1);
    // On the road he walks in the line, the arrival included.
    expect(at('forest_road', arrived).walking.map((who) => who.id)).toEqual(['follower.ruon']);
    // In Ba Dan he waits at the east-road mouth with Bo-shan, through the welcome.
    for (const nodes of [arrived, WALK_HOME]) {
      const village = at('ba_dan_village', nodes);
      expect(village.walking).toEqual([]);
      expect(village.standing.map(({ follower, pos }) => [follower.id, pos])).toEqual([
        ['follower.ruon', { x: 22, y: 6 }],
      ]);
    }
    const grid = buildGrid(CONTENT.maps.get('ba_dan_village')!);
    expect(tileAt(grid, { x: 22, y: 6 })?.blocked).toBe(false);
  });

  it('never doubles Ruon with his own figure in the Cutting', () => {
    const base = game();
    const map = CONTENT.maps.get('ambush_road');
    expect(map).toBeDefined();
    if (!map) return;
    let staged = 0;
    for (let index = 0; index < ESCORT.length; index++) {
      const state = {
        ...walked(base, ESCORT.slice(0, index + 1), index > 4 ? { ruon_spared: true } : {}),
        location: { mapId: map.id, pos: { x: 1, y: 4 } },
      };
      const standing = visibleNpcs(CONTENT, map, state).some((npc) => npc.id === 'ruon_cutting');
      if (standing) staged++;
      expect(standing && activeFollowers(state).length > 0, ESCORT[index]).toBe(false);
    }
    expect(staged).toBeGreaterThan(0);
  });

  it('holds Ruon in his surrender, sabre at his feet, only while he surrenders and the table votes', () => {
    const ruon = FOLLOWERS.find((who) => who.id === 'follower.ruon');
    expect(ruon).toBeDefined();
    if (!ruon) return;
    const base = game();
    const poseAlong = (route: readonly string[], flags: GameState['flags']) =>
      Object.fromEntries(
        route.map((node, index) => {
          const chosen = index > route.indexOf('ruon_choice') ? flags : {};
          return [
            node,
            followerPose(walked(base, route.slice(0, index + 1), chosen), ruon) ?? null,
          ];
        }),
      );
    const escort = poseAlong(ESCORT.slice(0, 8), { ruon_spared: true });
    expect(escort).toEqual({
      forest_after_explore: null,
      gate_parley: null,
      battle_quarry_gate: null,
      ruon_surrender: 'surrender',
      ruon_choice: 'surrender',
      // "If they catch us in the cutting, I'll need my sabre."
      escort_chosen: null,
      gate_escort_explore: null,
      cutting_explore: null,
    });
    const trade = poseAlong(TRADE.slice(0, 7), { ruon_traded: true });
    expect(trade.ruon_choice).toBe('surrender');
    expect(trade.trade_payment).toBeNull();
    // The earthbender's talk brings him to the same surrender.
    const talked = ['forest_after_explore', 'gate_parley', 'gate_kinship', 'gate_talked_through'];
    expect(followerPose(walked(base, [...talked, 'ruon_surrender'], {}), ruon)).toBe('surrender');
    // His top-down sheet carries the pose it names, one held cel.
    expect(TOPDOWN_SHEETS.ruon.surrender?.frames).toEqual(['unit.ally.ruon/surrender/0']);
  });
});
