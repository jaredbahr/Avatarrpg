import { describe, expect, it } from 'vitest';
import { CONTENT } from '../index';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import { npcNode, resolveDialogue } from '../../core/story/storyEngine';
import { worldObjective } from '../../core/story/world';
import type { GameState } from '../../core/types';

function game(flags: GameState['flags'] = {}): GameState {
  const initial = createGame(CONTENT, {
    seed: 'return-narrative',
    party: [{ characterId: 'wen' }],
    startNode: 'village_explore',
  });
  return { ...initial, flags };
}

function finish(state: GameState): GameState {
  for (let count = 0; state.screen === 'dialogue' && count < 12; count++) {
    state = apply(CONTENT, state, { type: 'advanceDialogue' }).state;
  }
  expect(state.screen).toBe('explore');
  return state;
}

const HOMECOMINGS = [
  ['ba_dan_village', 'elder_mira', 'mira_epilogue'],
  ['ba_dan_village', 'shopkeeper_gao', 'gao_home'],
  ['ba_dan_village', 'kid_pella', 'pella_home'],
  ['ba_dan_village', 'guard_dorin', 'dorin_home'],
  ['ba_dan_riverside', 'riverside_mira', 'riverside_mira_home'],
  ['forest_road', 'dema', 'dema_home'],
  ['ambush_road', 'rest_keeper', 'sen_home'],
] as const;

describe('the authored walk home', () => {
  it('keeps the opening objective directional after Mira has answered', () => {
    const state = finish(apply(CONTENT, game(), { type: 'enterNode', nodeId: 'mira_intro' }).state);
    expect(state.story.nodeId).toBe('village_explore');
    expect(worldObjective(CONTENT, state)).toBe(
      'Take the east road to the quarry. You can speak with the neighbors before you leave.',
    );
  });

  it('offers the quarry exit after victory and keeps defeat terminal', () => {
    const victory = CONTENT.story.get('act1_epilogue');
    const defeat = CONTENT.story.get('act1_epilogue_lost');
    if (victory?.kind !== 'end' || defeat?.kind !== 'end') throw new Error('Missing endings');
    expect(victory.next).toBe('quarry_after_explore');
    expect(defeat.next).toBeUndefined();
    if (!victory.next) throw new Error('Missing victory continuation');
    const ended = apply(CONTENT, game(), { type: 'enterNode', nodeId: 'act1_victory' }).state;
    const returned = apply(CONTENT, ended, { type: 'enterNode', nodeId: victory.next }).state;
    expect(returned.screen).toBe('explore');
    expect(returned.location.mapId).toBe('quarry_floor');
    expect(returned.flags).toEqual(ended.flags);
    expect(returned.party).toEqual(ended.party);
    expect(returned.battle).toBeNull();
  });

  it.each(HOMECOMINGS)(
    '%s/%s responds to rescue without replaying the request',
    (map, npc, node) => {
      const before = game({
        pella_asked: true,
        'world.ducks_seen': true,
        'world.tea_shared': true,
      });
      expect(npcNode(CONTENT, before, map, npc)).not.toBe(node);
      expect(npcNode(CONTENT, game({ act1_lost: true }), map, npc)).not.toBe(node);
      let state: GameState = { ...before, flags: { ...before.flags, act1_complete: true } };
      expect(npcNode(CONTENT, state, map, npc)).toBe(node);
      for (let visit = 0; visit < 2; visit++) {
        state = finish(apply(CONTENT, state, { type: 'enterNode', nodeId: node }).state);
        expect(state.location.mapId).toBe(map);
        expect(state.party).toEqual(before.party);
        expect(state.flags.act1_complete).toBe(true);
        expect(worldObjective(CONTENT, state)).toBeTruthy();
        expect(npcNode(CONTENT, state, map, npc)).toBe(node);
      }
    },
  );

  it('keeps Gao’s custody objection after rescue and Mira remembers both decisions', () => {
    const spared = game({ act1_complete: true, ruon_spared: true });
    const traded = game({ act1_complete: true, ruon_traded: true });
    expect(npcNode(CONTENT, spared, 'ba_dan_village', 'shopkeeper_gao')).toBe('gao_home');
    expect(npcNode(CONTENT, traded, 'ba_dan_village', 'shopkeeper_gao')).toBe('gao_home_cold');
    const mira = CONTENT.story.get('mira_epilogue');
    if (mira?.kind !== 'dialogue') throw new Error('Missing Mira return');
    expect(resolveDialogue(spared, mira).lines).not.toEqual(resolveDialogue(traded, mira).lines);
    expect(resolveDialogue(spared, mira).lines.join(' ')).toContain('maker-plate rubbing');
    expect(resolveDialogue(traded, mira).lines.join(' ')).toContain('maker-plate rubbing');
  });

  it('does not assume Pella was consulted before the rescue', () => {
    const pella = CONTENT.story.get('pella_home');
    if (pella?.kind !== 'dialogue') throw new Error('Missing Pella return');
    expect(resolveDialogue(game({ act1_complete: true }), pella).lines).not.toEqual(
      resolveDialogue(game({ act1_complete: true, pella_asked: true }), pella).lines,
    );
  });

  it('keeps return objectives after first and repeat roadside discoveries', () => {
    for (const [id, destination] of [
      ['duck_nest', 'forest_return_explore'],
      ['runoff_marker', 'forest_return_explore'],
      ['tea_station', 'cutting_return_explore'],
    ] as const) {
      let state = game({ act1_complete: true });
      for (const prefix of ['discover', 'revisit']) {
        state = finish(
          apply(CONTENT, state, { type: 'enterNode', nodeId: `${prefix}_${id}` }).state,
        );
        expect(state.story.nodeId).toBe(destination);
        const node = CONTENT.story.get(destination);
        if (node?.kind !== 'explore') throw new Error('Missing return exploration');
        expect(worldObjective(CONTENT, state)).toBe(node.objective);
      }
    }
  });

  it('changes the village cue after every homecoming has been visited', () => {
    const base = game({ act1_complete: true });
    const visited = ['mira_epilogue', 'pella_home', 'gao_home_cold', 'dorin_home'];
    const complete = {
      ...base,
      location: { ...base.location, mapId: 'ba_dan_village' },
      story: {
        ...base.story,
        nodeId: 'village_return_explore',
        visited,
      },
    };
    expect(worldObjective(CONTENT, complete)).toBe(
      "You've caught up with the village. Rest by the river, or explore the roads.",
    );

    const mapArrival = {
      ...complete,
      story: { ...complete.story, nodeId: null },
    };
    expect(worldObjective(CONTENT, mapArrival)).toBe(
      "You've caught up with the village. Rest by the river, or explore the roads.",
    );

    const pending = { ...complete, story: { ...complete.story, visited: visited.slice(0, 3) } };
    expect(worldObjective(CONTENT, pending)).toBe(
      'The workers are home. Talk with Mira, Pella, Gao or Dorin, or visit the river.',
    );
  });

  it('keeps the rescued riverside objective after an optional dialogue returns', () => {
    const state = game({ act1_complete: true });
    const riverside = {
      ...state,
      location: { ...state.location, mapId: 'ba_dan_riverside' },
      story: { ...state.story, nodeId: 'riverside_explore' },
    };
    expect(worldObjective(CONTENT, riverside)).toBe(
      'Rest by the river, or follow the southern path back to Ba Dan.',
    );
  });

  it('gives the three roadside discoveries a changed but honest return state', () => {
    const before = game();
    const after = game({ act1_complete: true });
    const markers = {
      duck_nest: 'nest is dry',
      runoff_marker: 'not clear yet',
      tea_station: 'last of the tea',
    } as const;

    for (const [id, marker] of Object.entries(markers)) {
      const first = CONTENT.story.get(`discover_${id}`);
      const revisit = CONTENT.story.get(`revisit_${id}`);
      if (first?.kind !== 'dialogue' || revisit?.kind !== 'dialogue') {
        throw new Error(`Missing discovery dialogue for ${id}`);
      }
      expect(resolveDialogue(before, first).lines).toEqual(resolveDialogue(after, first).lines);
      expect(resolveDialogue(before, revisit).lines).not.toEqual(
        resolveDialogue(after, revisit).lines,
      );
      expect(resolveDialogue(after, revisit).lines.join(' ')).toContain(marker);
    }
  });

  it('provides a different map objective on every part of the resolved route', () => {
    for (const mapId of [
      'quarry_floor',
      'ambush_road',
      'quarry_gate',
      'forest_road',
      'ba_dan_village',
      'ba_dan_riverside',
    ]) {
      const before = {
        ...game(),
        location: { mapId, pos: { x: 1, y: 1 } },
        story: { ...game().story, nodeId: 'act1_epilogue' },
      };
      const after = { ...before, flags: { act1_complete: true } };
      expect(worldObjective(CONTENT, after)).not.toBe(worldObjective(CONTENT, before));
      expect(worldObjective(CONTENT, after)).toBeTruthy();
    }
  });
});
