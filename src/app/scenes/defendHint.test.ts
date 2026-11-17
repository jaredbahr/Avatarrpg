import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../../core/rng';
import { createBattle, createGame } from '../../core/state/createGame';
import type { BattleState, Unit } from '../../core/types';
import { createMovementThreatQuery } from '../ui/movementThreats';
import { defendHintFlag, defendHintFor } from './defendHint';

function board(characters: readonly string[], level = 3) {
  const state = createGame(CONTENT, {
    seed: 'defend-hint',
    party: characters.map((characterId) => ({ characterId, level, autoChoose: true })),
    startNode: '',
  });
  const battle = createBattle(CONTENT, state, 'enc_quarry_gate', new RngCursor(state.rng));
  return { battle, query: createMovementThreatQuery(CONTENT) };
}

function change(battle: BattleState, id: string, patch: Partial<Unit>): BattleState {
  return { ...battle, units: battle.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) };
}

function hero(battle: BattleState, characterId: string): Unit {
  const unit = battle.units.find((u) => u.characterId === characterId);
  if (!unit) throw new Error(`no ${characterId}`);
  return unit;
}

/** Hurts `characterId` to `share` of their health and returns the board plus the hurt hero. */
function hurt(battle: BattleState, characterId: string, share: number) {
  const unit = hero(battle, characterId);
  const next = change(battle, unit.id, { hp: Math.max(1, Math.floor(unit.base.maxHp * share)) });
  return { battle: next, unit: hero(next, characterId) };
}

describe('the stay-safe hint', () => {
  it('stays quiet for a healthy hero nobody can reach', () => {
    const { battle, query } = board(['nilak', 'kaya', 'bo']);
    expect(defendHintFor(CONTENT, battle, hero(battle, 'nilak'), query)).toBeNull();
  });

  it('points a low healer at their own heal, by name', () => {
    const { battle, query } = board(['nilak', 'kaya', 'bo']);
    const low = hurt(battle, 'nilak', 0.2);
    const hint = defendHintFor(CONTENT, low.battle, low.unit, query);
    expect(hint?.kind).toBe('heal');
    const healer = CONTENT.abilities.get('healing_stream');
    expect(low.unit.abilities).toContain('healing_stream');
    expect(hint?.text).toContain(healer?.name);
    expect(hint?.text).toContain('yourself');
  });

  it('names a friend who can heal when the low hero cannot', () => {
    const { battle, query } = board(['nilak', 'kaya', 'bo']);
    const low = hurt(battle, 'kaya', 0.2);
    // Kaya's own turn: she has no heal, so the line points at Nilak's.
    const hint = defendHintFor(CONTENT, low.battle, low.unit, query);
    expect(hint?.kind).toBe('heal');
    expect(hint?.text).toContain('Nilak');
  });

  it('offers a Guard the hero can really use', () => {
    const { battle, query } = board(['bo', 'kaya', 'sura']);
    const low = hurt(battle, 'bo', 0.2);
    const hint = defendHintFor(CONTENT, low.battle, low.unit, query);
    expect(hint?.kind).toBe('guard');
    expect(hint?.text).toContain('Stone Stance');
    // Out of AP, the same hero is not told to cast it.
    const spent = change(low.battle, low.unit.id, { ap: 0 });
    expect(defendHintFor(CONTENT, spent, hero(spent, 'bo'), query)?.kind).not.toBe('guard');
  });

  it('suggests a step to safety only to a hero who is exposed and can walk', () => {
    const { battle, query } = board(['kaya', 'sura', 'bo']);
    const kaya = hero(battle, 'kaya');
    // Six tiles up the gate road the deserter can reach her, and a few steps back he cannot.
    // Stripped of every ability but Shove, so only the step is left to say.
    const exposed = change(battle, kaya.id, {
      pos: { x: 6, y: 3 },
      hp: Math.floor(kaya.base.maxHp * 0.6),
      abilities: [],
    });
    expect(query(exposed, kaya.id, { x: 6, y: 3 }).warning).toContain('could hit here');
    const hint = defendHintFor(CONTENT, exposed, hero(exposed, 'kaya'), query);
    expect(hint?.kind).toBe('retreat');
    expect(hint?.text).toMatch(/Step/);
    // Healthy, the same spot is not worth a word.
    const healthy = change(exposed, kaya.id, { hp: kaya.base.maxHp });
    expect(defendHintFor(CONTENT, healthy, hero(healthy, 'kaya'), query)).toBeNull();
    // Rooted in place she cannot step, so nothing is suggested.
    const rooted = change(exposed, kaya.id, { move: 0 });
    expect(defendHintFor(CONTENT, rooted, hero(rooted, 'kaya'), query)).toBeNull();
  });

  it('is for the table, not for the enemy or a finished fight', () => {
    const { battle, query } = board(['nilak', 'kaya', 'bo']);
    const low = hurt(battle, 'nilak', 0.2);
    const enemy = low.battle.units.find((u) => u.faction === 'enemy');
    if (!enemy) throw new Error('no enemy');
    expect(defendHintFor(CONTENT, low.battle, { ...enemy, hp: 1 }, query)).toBeNull();
    const won = { ...low.battle, phase: 'victory' as const };
    expect(defendHintFor(CONTENT, won, low.unit, query)).toBeNull();
  });

  it('keeps each kind of hint under its own guidance.tip flag', () => {
    expect(defendHintFlag('heal')).toBe('guidance.tip.defend.heal');
    expect(defendHintFlag('guard')).toBe('guidance.tip.defend.guard');
    expect(defendHintFlag('retreat')).toBe('guidance.tip.defend.retreat');
  });
});
