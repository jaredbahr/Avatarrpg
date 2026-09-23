/**
 * Background roles on the map (ADR 0047 §2, §8; W8 amendment).
 *
 * A role (the midday relief watch, Pella's household adult) is drawn but says
 * nothing. The rules therefore treat its tile the way they treat a person's:
 * a walk to it stops beside it, an approach to someone else never ends on it,
 * and settle never leaves the leader standing on one.
 */

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { apply } from '../state/reducer';
import { createGame } from '../state/createGame';
import { distance, posKey } from '../rules/grid';
import type { GameState, MapDef, Vec2 } from '../types';
import { settle } from './settle';
import { backgroundFigures, visibleNpcs } from './world';

const VILLAGE = CONTENT.maps.get('ba_dan_village') as MapDef;
const POST: Vec2 = { x: 20, y: 9 };
const YARD: Vec2 = { x: 11, y: 13 };

/** A new game (midday, D4) exploring the village with the leader at `pos`. */
function at(pos: Vec2, visited: readonly string[] = []): GameState {
  const base = createGame(CONTENT, {
    seed: 'roles',
    party: ['kaya', 'sura'].map((characterId) => ({ characterId })),
    startNode: 'village_explore',
  });
  return {
    ...base,
    screen: 'explore',
    story: { ...base.story, nodeId: 'village_explore', visited: [...visited] },
    location: { mapId: VILLAGE.id, pos },
  };
}

const roleTiles = (state: GameState) =>
  new Set(backgroundFigures(CONTENT, VILLAGE, state).map((role) => posKey(role.pos)));

describe('background roles on the village (W8)', () => {
  it('staff the gate at midday before victory, and stand the household adult by Pella', () => {
    const state = at({ x: 3, y: 7 });
    expect(state.world.clock.phase).toBe('midday');
    expect(backgroundFigures(CONTENT, VILLAGE, state)).toEqual([
      { id: 'bg.relief_watch', label: 'Relief watch', sprite: 'npc.guard', pos: POST },
      { id: 'bg.pella_household', label: "Pella's household", sprite: 'npc.household', pos: YARD },
    ]);
    // Nobody else is on the post: Dorin is at his drill on the riverside (D3).
    expect(visibleNpcs(CONTENT, VILLAGE, state).some((npc) => posKey(npc.pos) === '20,9')).toBe(
      false,
    );
  });

  it('walk the party up to a role, never onto its tile, and open nothing', () => {
    const result = apply(CONTENT, at({ x: 14, y: 7 }), { type: 'walkTo', pos: POST });
    expect(result.state.screen).toBe('explore');
    expect(distance(result.state.location.pos, POST)).toBe(1);
    expect(result.events.some((event) => event.type === 'partyWalked')).toBe(true);
    // Already beside them: nothing happens, and nothing is said.
    const beside = apply(CONTENT, result.state, { type: 'walkTo', pos: POST });
    expect(beside.events).toEqual([]);
    expect(beside.state.location.pos).toEqual(result.state.location.pos);
  });

  it('keep an approach to Pella off the household adult beside her', () => {
    // From here the first tile beside Pella that `findApproach` tries is the yard itself.
    const result = apply(CONTENT, at({ x: 12, y: 14 }), { type: 'walkTo', pos: { x: 11, y: 12 } });
    expect(result.state.screen).toBe('dialogue');
    expect(distance(result.state.location.pos, { x: 11, y: 12 })).toBe(1);
    expect(roleTiles(result.state).has(posKey(result.state.location.pos))).toBe(false);
  });

  it('step the leader off a role tile after any command, onto nobody', () => {
    const state = at(POST);
    const result = settle(CONTENT, state, state);
    const pos = result.state.location.pos;
    expect(pos).not.toEqual(POST);
    expect(roleTiles(result.state).has(posKey(pos))).toBe(false);
    expect(
      visibleNpcs(CONTENT, VILLAGE, result.state).some((npc) => posKey(npc.pos) === posKey(pos)),
    ).toBe(false);
    expect(result.events).toEqual([
      { type: 'partyWalked', unitId: state.party[0]?.id, from: POST, path: [pos] },
    ]);
    expect(result.state.rng).toEqual(state.rng);
  });
});
