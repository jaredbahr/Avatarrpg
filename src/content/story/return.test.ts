import { describe, expect, it } from 'vitest';
import { CONTENT, RETURNEE_IDS } from '../index';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import {
  advanceDialogue,
  enterStoryNode,
  npcNode,
  resolveDialogue,
} from '../../core/story/storyEngine';
import { visibleNpcs, worldObjective } from '../../core/story/world';
import { resolveResidents } from '../../core/story/residents';
import { evaluate } from '../../core/story/conditions';
import type { ContentIndex, GameState, ResidentProfile, StoryNode } from '../../core/types';

function game(flags: GameState['flags'] = {}): GameState {
  const initial = createGame(CONTENT, {
    seed: 'return-narrative',
    party: [{ characterId: 'wen' }],
    startNode: 'village_explore',
  });
  return { ...initial, flags };
}

const profiles = (profile: ResidentProfile) =>
  Object.fromEntries(RETURNEE_IDS.map((id) => [id, profile]));

function withProfiles(state: GameState, profile: ResidentProfile): GameState {
  return {
    ...state,
    world: { ...state.world, residentProfiles: profiles(profile) },
  };
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

/** Where a homecoming routes once it has been heard, when that differs. */
const REVISITS: Readonly<Record<string, string>> = { elder_mira: 'mira_rubbing_kept' };

describe('the authored walk home', () => {
  it('keeps the opening objective directional after Mira has answered', () => {
    const state = finish(apply(CONTENT, game(), { type: 'enterNode', nodeId: 'mira_intro' }).state);
    expect(state.story.nodeId).toBe('village_explore');
    expect(worldObjective(CONTENT, state)).toBe(
      'Take the east road to the quarry. You can speak with the neighbors before you leave.',
    );
  });

  it('frees the workers into the walk home after victory and keeps defeat terminal', () => {
    const victory = CONTENT.story.get('act1_epilogue');
    const defeat = CONTENT.story.get('act1_epilogue_lost');
    if (victory?.kind !== 'dialogue' || defeat?.kind !== 'end') throw new Error('Missing endings');
    expect(victory.next).toBe('act1_evening');
    expect(defeat.next).toBeUndefined();
    const lost = enterStoryNode(CONTENT, game(), 'act1_lost').state;
    expect(lost.world.residentProfiles).toEqual({});
    if (!victory.next) throw new Error('Missing victory continuation');
    const ended = apply(CONTENT, game(), { type: 'enterNode', nodeId: 'act1_victory' }).state;
    expect(ended.world.residentProfiles).toEqual(profiles('returning'));
    const returned = apply(CONTENT, ended, { type: 'enterNode', nodeId: victory.next }).state;
    expect(returned.screen).toBe('explore');
    expect(returned.location.mapId).toBe('quarry_floor');
    expect(returned.flags).toEqual(ended.flags);
    expect(returned.party).toEqual(ended.party);
    expect(returned.battle).toBeNull();
  });

  it('changes returning profiles only when the neutral arrival completes', () => {
    const victory = enterStoryNode(CONTENT, game(), 'act1_victory').state;
    const onRoad: GameState = {
      ...victory,
      screen: 'explore',
      location: { mapId: 'forest_road', pos: { x: 1, y: 4 } },
      story: { ...victory.story, nodeId: 'forest_return_explore' },
    };
    const entered = enterStoryNode(CONTENT, onRoad, 'forest_return_arrival').state;
    expect(entered.screen).toBe('dialogue');
    expect(entered.location.mapId).toBe('forest_road');
    expect(entered.world.residentProfiles).toEqual(profiles('returning'));

    const savedMidArrival = structuredClone(entered);
    const afterFirstLine = advanceDialogue(CONTENT, savedMidArrival).state;
    expect(afterFirstLine.world.residentProfiles).toEqual(profiles('returning'));
    expect(afterFirstLine.location.mapId).toBe('forest_road');

    const arrived = advanceDialogue(CONTENT, afterFirstLine).state;
    expect(arrived.world.residentProfiles).toEqual(profiles('resting'));
    expect(arrived.location.mapId).toBe('ba_dan_village');
    expect(arrived.story.nodeId).toBe('village_return_explore');
  });

  it('ends the demo with a welcome home on the first step into Ba Dan', () => {
    const victory = enterStoryNode(CONTENT, game({ ruon_spared: true }), 'act1_victory').state;
    const onRoad: GameState = {
      ...victory,
      screen: 'explore',
      location: { mapId: 'forest_road', pos: { x: 1, y: 4 } },
      story: { ...victory.story, nodeId: 'forest_return_explore' },
    };
    let home = enterStoryNode(CONTENT, onRoad, 'forest_return_arrival').state;
    for (let count = 0; home.screen === 'dialogue' && count < 4; count++)
      home = advanceDialogue(CONTENT, home).state;
    expect(home.location.mapId).toBe('ba_dan_village');
    expect(home.screen).toBe('explore');
    const at = { ...home, location: { ...home.location, pos: { x: 22, y: 7 } } };

    const welcomed = apply(CONTENT, at, { type: 'walkTo', pos: { x: 18, y: 7 } }).state;
    expect(welcomed.story.nodeId).toBe('welcome_home_mira');
    expect(welcomed.location.pos).toEqual({ x: 20, y: 7 });

    let card = welcomed;
    const speakers: string[] = [];
    for (let count = 0; card.screen === 'dialogue' && count < 12; count++) {
      const node = CONTENT.story.get(card.story.nodeId ?? '');
      if (node?.kind === 'dialogue' && !speakers.includes(node.speaker))
        speakers.push(node.speaker);
      card = advanceDialogue(CONTENT, card).state;
    }
    expect(speakers).toEqual(['Elder Mira', 'Gao the Shopkeeper', 'Gate Guard Dorin']);
    expect(card.screen).toBe('ended');
    expect(card.story.nodeId).toBe('demo_complete');

    // The card leads on to free roam, and the welcome never plays twice.
    const roam = apply(CONTENT, card, {
      type: 'enterNode',
      nodeId: 'village_return_explore',
    }).state;
    expect(roam.screen).toBe('explore');
    const again = apply(CONTENT, roam, { type: 'walkTo', pos: { x: 22, y: 8 } }).state;
    const back = apply(CONTENT, again, { type: 'walkTo', pos: { x: 18, y: 7 } }).state;
    expect(back.screen).toBe('explore');
  });

  it('pays off the gate and Ruon choices in the welcome home and the recap', () => {
    const ending = CONTENT.story.get('demo_complete');
    if (ending?.kind !== 'end' || !ending.recap) throw new Error('Missing the demo ending');
    const recap = ending.recap;
    const choices = (flags: GameState['flags']) =>
      recap.choices.filter((choice) => evaluate(game(flags), choice.when)).map((c) => c.text);
    const line = (nodeId: string, flags: GameState['flags'], index: number) =>
      resolveDialogue(game(flags), CONTENT.story.get(nodeId) as never).lines[index];

    const gates = [
      [{}, 'knocked', 'knocked'],
      [{ gate_talked_through: true }, 'talked Captain Ruon', 'talked the quarry gate open'],
      [{ gate_fire_bluff: true }, 'bluffed the deserter', 'stared the deserter'],
      [{ gate_fire_bluff: true, lost_quarry_gate: true }, 'drove you back', 'chased you down'],
    ] as const;
    for (const [flags, recapText, dorinText] of gates) {
      const gate = choices(flags).filter((text) => text.startsWith('At the quarry gate'));
      expect(gate).toHaveLength(1);
      expect(gate[0]).toContain(recapText);
      expect(line('welcome_home_dorin', flags, 0)).toContain(dorinText);
    }

    expect(choices({ ruon_spared: true })).toContain(
      'You brought Captain Ruon home to answer to the families.',
    );
    expect(choices({ ruon_traded: true })).toContain(
      'You traded Captain Ruon to Jin for the quarry key.',
    );
    expect(line('welcome_home_gao', { ruon_spared: true }, 1)).toContain('beside you');
    expect(line('welcome_home_gao', { ruon_traded: true }, 1)).toContain('Jin has him now');
    expect(line('welcome_home_mira', { pella_asked: true }, 1)).toContain('Pella reached Bo-shan');
    expect(line('welcome_home_mira', {}, 1)).toContain('soup');
  });

  it('allows an explicit later liberation without clearing the loss history', () => {
    const liberation: StoryNode = {
      id: 'test_later_liberation',
      kind: 'flags',
      set: { liberation_complete: true },
      residentProfiles: profiles('returning'),
      next: 'forest_return_explore',
    };
    const content: ContentIndex = {
      ...CONTENT,
      story: new Map([...CONTENT.story, [liberation.id, liberation]]),
    };
    const lost = enterStoryNode(CONTENT, game(), 'act1_lost').state;
    const liberated = enterStoryNode(content, lost, liberation.id).state;
    expect(liberated.flags.act1_lost).toBe(true);
    expect(liberated.flags.liberation_complete).toBe(true);
    expect(liberated.world.residentProfiles).toEqual(profiles('returning'));
  });

  it('uses profile ownership for returning and home objectives', () => {
    const road = withProfiles(
      {
        ...game({ act1_complete: true }),
        location: { mapId: 'forest_road', pos: { x: 2, y: 4 } },
        story: { ...game().story, nodeId: null },
      },
      'returning',
    );
    expect(worldObjective(CONTENT, road)).toContain('returning');
    expect(worldObjective(CONTENT, road)).not.toContain('home');

    const village = withProfiles(
      { ...road, location: { mapId: 'ba_dan_village', pos: { x: 22, y: 7 } } },
      'resting',
    );
    expect(worldObjective(CONTENT, village)).toContain('home');
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
        // Mira's first homecoming takes the maker-plate rubbing (#628); every
        // later visit is the settled conversation, never the request again.
        expect(npcNode(CONTENT, state, map, npc)).toBe(REVISITS[npc] ?? node);
      }
    },
  );

  it('hands the maker-plate rubbing to Mira once, behind a flag', () => {
    for (const custody of ['ruon_spared', 'ruon_traded'] as const) {
      let state = game({ act1_complete: true, [custody]: true });
      expect(npcNode(CONTENT, state, 'ba_dan_village', 'elder_mira')).toBe('mira_epilogue');
      state = apply(CONTENT, state, { type: 'enterNode', nodeId: 'mira_epilogue' }).state;
      expect(state.flags.rubbing_given).toBeUndefined();
      const ask = CONTENT.story.get('mira_epilogue');
      if (ask?.kind !== 'dialogue') throw new Error('Missing Mira return');
      expect(ask.next).toBe('mira_rubbing');
      const handOver = CONTENT.story.get('mira_rubbing');
      if (handOver?.kind !== 'dialogue') throw new Error('Missing the rubbing hand-over');
      expect(handOver.lines.join(' ')).toContain('rubbing');
      state = finish(apply(CONTENT, state, { type: 'enterNode', nodeId: 'mira_rubbing' }).state);
      expect(state.flags.rubbing_given).toBe(true);
      expect(state.story.nodeId).toBe('village_return_explore');
      expect(npcNode(CONTENT, state, 'ba_dan_village', 'elder_mira')).toBe('mira_rubbing_kept');
      const kept = CONTENT.story.get('mira_rubbing_kept');
      if (kept?.kind !== 'dialogue') throw new Error('Missing Mira after the rubbing');
      expect(kept.lines.join(' ')).not.toMatch(/bring me/i);
    }
  });

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
    const base = withProfiles(game({ act1_complete: true }), 'resting');
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

  it('reads legacy Act I completion as home without assigning resident profiles', () => {
    const base = game({ act1_complete: true });
    const legacy = {
      ...base,
      location: { ...base.location, mapId: 'ba_dan_village' },
    };
    const expected =
      'The workers are home. Talk with Mira, Pella, Gao or Dorin, or visit the river.';

    expect(worldObjective(CONTENT, legacy)).toBe(expected);
    expect(
      worldObjective(CONTENT, {
        ...legacy,
        story: { ...legacy.story, nodeId: null },
      }),
    ).toBe(expected);
    expect(legacy.world.residentProfiles).toEqual({});
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
      const after = withProfiles(
        { ...before, flags: { act1_complete: true } },
        mapId === 'ba_dan_village' ? 'resting' : 'returning',
      );
      expect(worldObjective(CONTENT, after)).not.toBe(worldObjective(CONTENT, before));
      expect(worldObjective(CONTENT, after)).toBeTruthy();
    }
  });
});

describe('staging the quarry dialogue (#628)', () => {
  const visit = (state: GameState, ...nodeIds: string[]): GameState => ({
    ...state,
    story: { ...state.story, visited: [...state.story.visited, ...nodeIds] },
  });

  it('stands Ruon in the Cutting from his aftermath until the descent', () => {
    const cutting = CONTENT.maps.get('ambush_road');
    if (!cutting) throw new Error('Missing the Cutting');
    const ruonOn = (state: GameState) =>
      visibleNpcs(CONTENT, cutting, state).some((npc) => npc.id === 'ruon_cutting');
    const spared = game({ ruon_spared: true });
    expect(ruonOn(spared)).toBe(false);
    expect(ruonOn(visit(spared, 'after_ambush'))).toBe(true);
    expect(ruonOn(visit(spared, 'after_ambush', 'quarry_descent'))).toBe(false);
    expect(ruonOn(visit(game({ ruon_traded: true }), 'trade_chosen'))).toBe(false);
    const ruon = visibleNpcs(CONTENT, cutting, visit(spared, 'after_ambush')).find(
      (npc) => npc.id === 'ruon_cutting',
    );
    expect(npcNode(CONTENT, visit(spared, 'after_ambush'), 'ambush_road', 'ruon_cutting')).toBe(
      'ruon_cutting',
    );
    expect(ruon?.sprite).toBe('unit.ally.ruon');
  });

  it('walks three freed workers into Ba Dan until the welcome home has played', () => {
    const village = CONTENT.maps.get('ba_dan_village');
    if (!village) throw new Error('Missing Ba Dan');
    const walkers = (state: GameState) =>
      resolveResidents(CONTENT, state)
        .placements.filter(
          (p) => (RETURNEE_IDS as readonly string[]).includes(p.id) && p.mapId === village.id,
        )
        .map((p) => p.id)
        .sort();
    const arrived = enterStoryNode(
      CONTENT,
      visit(game({ act1_complete: true }), 'forest_return_arrival'),
      'forest_return_arrived',
    ).state;
    expect(arrived.world.residentProfiles).toEqual(profiles('resting'));
    expect(walkers(arrived)).toEqual(['lw.npc.amri', 'lw.npc.bo_shan', 'lw.npc.leto']);
    // Each stands on a walkable cell at the east-road mouth the party walks in by.
    for (const placement of resolveResidents(CONTENT, arrived).placements) {
      if (!walkers(arrived).includes(placement.id)) continue;
      expect(placement.pos?.x).toBeGreaterThanOrEqual(20);
      const key = placement.pos ? village.rows[placement.pos.y]?.[placement.pos.x] : undefined;
      expect(key && village.legend[key]?.blocked).toBeFalsy();
    }
    expect(walkers(visit(arrived, 'demo_complete'))).toEqual([]);
  });
});
