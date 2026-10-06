/**
 * F1: an action that kills its own actor must not leave the party stuck.
 *
 * A 1-HP party member walking onto fire (or a firebender dashing into the
 * flames they just lit) dies mid-activation. Before the fix the reducer settled
 * the outcome and returned, so a still-active fight kept pointing `turnIndex`
 * at the corpse: the party had no control and no AI was scheduled. The shared
 * action tail now hands the turn on through the normal upkeep/skip path.
 *
 * These are reducer-level integration tests: they drive `apply` and read the
 * resulting battle state and events, exactly as presentation does.
 */

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor, nextChance } from '../rng';
import { withSurface } from '../rules/grid';
import { isAlive } from '../rules/stats';
import { activeUnit } from '../rules/turnOrder';
import type { GameState, Vec2 } from '../types';
import { createBattle, createGame } from './createGame';
import { apply } from './reducer';

/** Where the test parks the acting unit and where it steps into fire. */
const FROM: Vec2 = { x: 2, y: 5 };
const INTO_FIRE: Vec2 = { x: 3, y: 5 };

type PartyMember = { readonly characterId: string; readonly level?: number };

/**
 * A Quarry Gate battle with Kaya parked on open road and acting first. The
 * gate's west approach is clear, so the step targets and enemy spawns never
 * overlap.
 */
function gateBattle(seed: string, party: readonly PartyMember[]) {
  const seeded = createGame(CONTENT, { seed, party, startNode: '' });
  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(CONTENT, seeded, 'enc_quarry_gate', rng);
  const kaya = battle.units.find((unit) => unit.characterId === 'kaya');
  if (!kaya) throw new Error('the fixture lost Kaya');

  const state: GameState = {
    ...seeded,
    screen: 'combat',
    rng: rng.state,
    battle: {
      ...battle,
      units: battle.units.map((unit) => (unit.id === kaya.id ? { ...unit, pos: FROM } : unit)),
      order: [kaya.id, ...battle.order.filter((id) => id !== kaya.id)],
      turnIndex: 0,
    },
  };
  return { state, kayaId: kaya.id };
}

/** The same battle with fire on the destination and Kaya at `hp`. */
function withFire(state: GameState, kayaId: string, hp: number): GameState {
  const battle = state.battle;
  if (!battle) throw new Error('the fixture has no battle');
  return {
    ...state,
    battle: {
      ...battle,
      grid: withSurface(battle.grid, INTO_FIRE, { id: 'fire', duration: 2, spread: 0 }),
      units: battle.units.map((unit) => (unit.id === kayaId ? { ...unit, hp } : unit)),
    },
  };
}

function battleOf(state: GameState) {
  if (!state.battle) throw new Error('the battle ended unexpectedly');
  return state.battle;
}

describe('a lethal action by the active unit', () => {
  it('advances to a living ally when a lethal move kills the active party unit', () => {
    const { state, kayaId } = gateBattle('f1-lethal-move', [
      { characterId: 'kaya', level: 3 },
      { characterId: 'bo', level: 3 },
    ]);

    const result = apply(CONTENT, withFire(state, kayaId, 1), {
      type: 'move',
      unitId: kayaId,
      path: [INTO_FIRE],
    });
    const battle = battleOf(result.state);

    expect(battle.phase).toBe('active');
    expect(battle.units.find((unit) => unit.id === kayaId)?.hp).toBe(0);
    const active = activeUnit(battle);
    expect(active?.id).not.toBe(kayaId);
    expect(active !== undefined && isAlive(active)).toBe(true);
    // The turn was genuinely handed on exactly once, not abandoned or repeated.
    expect(result.events.filter((event) => event.type === 'turnEnded')).toHaveLength(1);
    expect(result.events.filter((event) => event.type === 'turnStarted')).toHaveLength(1);
  });

  it('keeps the same actor active after a nonlethal move', () => {
    const { state, kayaId } = gateBattle('f1-nonlethal-move', [
      { characterId: 'kaya', level: 3 },
      { characterId: 'bo', level: 3 },
    ]);

    const before = withFire(state, kayaId, 20);
    const result = apply(CONTENT, before, {
      type: 'move',
      unitId: kayaId,
      path: [INTO_FIRE],
    });
    const battle = battleOf(result.state);
    const kaya = battle.units.find((unit) => unit.id === kayaId);

    // The move hurt but did not kill; nothing about the turn changed.
    expect(kaya?.hp).toBe(16);
    expect(kaya !== undefined && isAlive(kaya)).toBe(true);
    expect(battle.order[battle.turnIndex]).toBe(kayaId);
    expect(activeUnit(battle)?.id).toBe(kayaId);
    expect(result.events.some((event) => event.type === 'turnEnded')).toBe(false);
    expect(result.events.some((event) => event.type === 'turnStarted')).toBe(false);
    // No spurious hand-off means no extra draws: the move's only draw is the
    // fire tile's Burning contact chance, so the cursor advances by exactly
    // that one step and a control run of the same move lands on the same value.
    const expected = nextChance(before.rng, 1).rng;
    expect(result.state.rng).toBe(expected);
  });

  it('ends in defeat when the last party member dies to its own move', () => {
    const { state, kayaId } = gateBattle('f1-last-party', [{ characterId: 'kaya', level: 3 }]);

    const result = apply(CONTENT, withFire(state, kayaId, 1), {
      type: 'move',
      unitId: kayaId,
      path: [INTO_FIRE],
    });
    const battle = battleOf(result.state);

    expect(battle.phase).toBe('defeat');
    expect(battle.units.find((unit) => unit.id === kayaId)?.hp).toBe(0);
    expect(
      result.events.some((event) => event.type === 'battleEnded' && event.outcome === 'defeat'),
    ).toBe(true);
  });

  it('advances when a caster is killed by the fire it dashes into', () => {
    const { state, kayaId } = gateBattle('f1-lethal-ability', [
      { characterId: 'kaya', level: 3 },
      { characterId: 'bo', level: 3 },
    ]);
    const starting = battleOf(state);
    const prepared: GameState = {
      ...state,
      battle: {
        ...starting,
        units: starting.units.map((unit) =>
          unit.id === kayaId
            ? { ...unit, hp: 1, abilities: [...unit.abilities, 'fire_step'], ap: 3 }
            : unit,
        ),
      },
    };

    const result = apply(CONTENT, prepared, {
      type: 'useAbility',
      unitId: kayaId,
      abilityId: 'fire_step',
      target: INTO_FIRE,
    });
    const battle = battleOf(result.state);

    // `fire_step` dashes into its own flames: shipped content kills the caster.
    expect(battle.phase).toBe('active');
    expect(battle.units.find((unit) => unit.id === kayaId)?.hp).toBe(0);
    const active = activeUnit(battle);
    expect(active?.id).not.toBe(kayaId);
    expect(active !== undefined && isAlive(active)).toBe(true);
    expect(result.events.some((event) => event.type === 'turnStarted')).toBe(true);
  });
});
