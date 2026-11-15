import { describe, expect, it } from 'vitest';
import { CONTENT } from '../index';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import { npcNode, resolveDialogue } from '../../core/story/storyEngine';
import { visibleNpcs, worldObjective } from '../../core/story/world';
import { evaluate } from '../../core/story/conditions';
import { reconcileDisciplines, reconcileWorld } from '../../core/save/reconcile';
import { SAVE_MAGIC, deserialize, serialize, stateFromBlob } from '../../core/save/serialize';
import { DAY_PHASES } from '../../core/types';
import type { DayPhase, GameState, StoryNode } from '../../core/types';
import { LOST_OBJECTIVE } from './lost';

/**
 * The Driller loss carries on (story bible C-01, C-02, C-16; owner,
 * 2026-11-14). These hold the route's facts, not its wording: where it goes,
 * who is where afterwards, and that a save made at the old terminal card
 * continues into the same village.
 */

const META = {
  label: 'Slot 1',
  summary: 'Test save',
  savedAt: 1_700_000_000_000,
  session: { players: [{ name: 'Ana', unitId: 'p0' }], soloPlay: false },
};

function game(party: readonly string[] = ['wen'], flags: GameState['flags'] = {}): GameState {
  const initial = createGame(CONTENT, {
    seed: 'driller-loss',
    party: party.map((characterId) => ({ characterId })),
    startNode: 'village_explore',
  });
  return { ...initial, flags: { ...initial.flags, ...flags } };
}

/** Plays dialogue through to the next non-dialogue screen. */
function playOn(state: GameState): GameState {
  for (let count = 0; state.screen === 'dialogue' && count < 40; count++)
    state = apply(CONTENT, state, { type: 'advanceDialogue' }).state;
  return state;
}

/** From the Driller's defeat branch to the chapter card. */
function lose(party?: readonly string[], flags?: GameState['flags']): GameState {
  return playOn(
    apply(CONTENT, game(party, flags), { type: 'enterNode', nodeId: 'defeat_boss' }).state,
  );
}

function node(id: string): StoryNode {
  const found = CONTENT.story.get(id);
  if (!found) throw new Error(`Missing ${id}`);
  return found;
}

function dialogue(id: string): Extract<StoryNode, { kind: 'dialogue' }> {
  const found = node(id);
  if (found.kind !== 'dialogue') throw new Error(`${id} is not dialogue`);
  return found;
}

function atPhase(state: GameState, phase: DayPhase): GameState {
  return { ...state, world: { ...state.world, clock: { ...state.world.clock, phase } } };
}

function intoVillage(card: GameState): GameState {
  const end = node('act1_epilogue_lost');
  if (end.kind !== 'end' || !end.next) throw new Error('The loss card has no way on');
  return apply(CONTENT, card, { type: 'enterNode', nodeId: end.next }).state;
}

const village = () => {
  const map = CONTENT.maps.get('ba_dan_village');
  if (!map) throw new Error('Missing Ba Dan');
  return map;
};

describe('carrying on after the Driller (C-01, C-02, C-16)', () => {
  it('plays the escape, the night at home and the morning cart, then the chapter card', () => {
    const card = lose();
    expect(card.screen).toBe('ended');
    expect(card.story.nodeId).toBe('act1_epilogue_lost');
    expect(card.flags.act1_lost).toBe(true);
    expect(card.flags.act1_complete).toBeUndefined();
    for (const id of [
      'defeat_boss_drain',
      'defeat_boss_road',
      'defeat_boss_fork',
      'lost_home_table',
      'lost_home_note',
      'lost_home_pella',
      'lost_home_answer',
      'lost_departure',
      'lost_departure_permit',
      'lost_departure_road',
    ])
      expect(card.story.visited, id).toContain(id);
    // The card falls on the next morning, and nobody comes home.
    expect(card.world.clock).toEqual({ day: 2, phase: 'morning' });
    expect(card.world.residentProfiles).toEqual({});
    // The victory's scenes never play on a loss.
    for (const id of ['act1_epilogue', 'welcome_home_mira', 'cart_departure', 'demo_complete'])
      expect(card.story.visited, id).not.toContain(id);
  });

  it('keeps every line of the loss route inside the scene, whoever is in the party', () => {
    // Wen owns the plan that missed the ramp; anyone else hears the narrator.
    const withWen = resolveDialogue(game(['wen']), dialogue('defeat_boss'));
    const without = resolveDialogue(game(['riko']), dialogue('defeat_boss'));
    expect(withWen.speaker).toBe('Wen');
    expect(without.speaker).toBe('The Quarry');
    // Escorted, Ruon comes down the drain last; traded, he is not there to.
    const drain = dialogue('defeat_boss_drain');
    const spared = resolveDialogue(game(['riko'], { ruon_spared: true }), drain);
    const traded = resolveDialogue(game(['riko'], { ruon_traded: true }), drain);
    expect(spared.lines.join(' ')).toContain('Ruon');
    expect(traded.lines.join(' ')).not.toContain('Ruon');
  });

  it('opens the card onto occupied Ba Dan, with Dorin away and Hanru at the gate', () => {
    const roam = intoVillage(lose());
    expect(roam.screen).toBe('explore');
    expect(roam.location.mapId).toBe('ba_dan_village');
    expect(worldObjective(CONTENT, roam)).toBe(LOST_OBJECTIVE.text);
    for (const phase of DAY_PHASES) {
      const ids = visibleNpcs(CONTENT, village(), atPhase(roam, phase)).map((npc) => npc.id);
      expect(ids, phase).not.toContain('guard_dorin');
      if (phase !== 'midday') expect(ids, phase).toContain('guard_hanru');
    }
  });

  it('gives the people of occupied Ba Dan their own word, and brings each back to a hub', () => {
    const roam = intoVillage(lose());
    const talks: [string, string, string][] = [
      ['ba_dan_village', 'elder_mira', 'mira_lost'],
      ['ba_dan_village', 'shopkeeper_gao', 'gao_lost'],
      ['ba_dan_village', 'kid_pella', 'pella_lost'],
      ['forest_road', 'dema', 'dema_lost'],
      ['ambush_road', 'rest_keeper', 'sen_lost'],
    ];
    for (const [mapId, npcId, expected] of talks) {
      expect(npcNode(CONTENT, roam, mapId, npcId), npcId).toBe(expected);
      const done = playOn(apply(CONTENT, roam, { type: 'enterNode', nodeId: expected }).state);
      expect(done.screen, expected).toBe('explore');
      expect(done.flags, expected).toEqual(roam.flags);
      // Back on its own map, with the occupied valley's objective, never the quarry run's.
      expect(done.location.mapId, expected).toBe(mapId);
      expect(worldObjective(CONTENT, done), expected).toMatch(/still held|watching/);
    }
    // Hanru and riverside Mira speak to the occupied valley too.
    const hanru = resolveDialogue(roam, dialogue('hanru_watch'));
    expect(hanru.lines.join(' ')).toContain('Dorin left me the gate');
    const mira = resolveDialogue(roam, dialogue('riverside_mira'));
    expect(mira.lines.join(' ')).not.toContain('practises');
  });

  it('keeps the occupied quarry shut, and the village unpunished', () => {
    const roam = intoVillage(lose());
    const cutting = CONTENT.maps.get('ambush_road');
    const toFloor = cutting?.exits?.find((exit) => exit.toMapId === 'quarry_floor');
    expect(toFloor?.requires).toBeDefined();
    expect(evaluate(roam, toFloor?.requires ?? { kind: 'all', of: [] })).toBe(false);
    // The same exit stays open on a clean route.
    const traded: GameState = {
      ...game(),
      story: { ...game().story, visited: ['trade_chosen'] },
    };
    expect(evaluate(traded, toFloor?.requires ?? { kind: 'all', of: [] })).toBe(true);
    // Ba Dan's own people are all still there.
    const ids = visibleNpcs(CONTENT, village(), atPhase(roam, 'midday')).map((npc) => npc.id);
    for (const id of ['elder_mira', 'shopkeeper_gao', 'kid_pella']) expect(ids).toContain(id);
  });

  it('continues a save made at the old terminal card into the same village', () => {
    // Before C-01 the card was an `end` with no way on, so a save there sat on
    // the "ended" screen. Its node id and flag are unchanged; it loads as it
    // was and the card now offers the way on, with no migration needed.
    const base = game(['kaya', 'sura', 'bo'], { act1_lost: true, ruon_spared: true });
    const old: GameState = {
      ...base,
      screen: 'ended',
      battle: null,
      location: { mapId: 'quarry_floor', pos: { x: 3, y: 5 } },
      story: {
        ...base.story,
        nodeId: 'act1_epilogue_lost',
        visited: ['village_explore', 'mira_intro', 'battle_grumbler', 'defeat_boss', 'act1_lost'],
        lineIndex: 0,
      },
    };
    const result = deserialize(serialize(old, META));
    if (!result.ok) throw new Error(result.error);
    expect(result.blob.magic).toBe(SAVE_MAGIC);
    const loaded = reconcileWorld(
      CONTENT,
      reconcileDisciplines(CONTENT, stateFromBlob(result.blob)),
    );
    expect(loaded.screen).toBe('ended');
    expect(loaded.story.nodeId).toBe('act1_epilogue_lost');
    const roam = intoVillage(loaded);
    expect(roam.screen).toBe('explore');
    expect(roam.location.mapId).toBe('ba_dan_village');
    expect(npcNode(CONTENT, roam, 'ba_dan_village', 'elder_mira')).toBe('mira_lost');
    const ids = visibleNpcs(CONTENT, village(), atPhase(roam, 'afternoon')).map((npc) => npc.id);
    expect(ids).not.toContain('guard_dorin');
    expect(ids).toContain('guard_hanru');
  });
});
