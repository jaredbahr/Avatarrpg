import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { createBattle, createGame } from '../state/createGame';
import { RngCursor } from '../rng';
import type { BattleState, Unit } from '../types';
import { directAttackThreats, type ThreatBudget } from './directAttackThreats';
import { affectedTiles, isValidTarget } from './abilities';
import { posKey } from './grid';

function fixture() {
  const state = createGame(CONTENT, {
    seed: 'gate-threat',
    party: [{ characterId: 'sura', level: 2 }],
    startNode: '',
  });
  const battle = createBattle(CONTENT, state, 'enc_quarry_gate', new RngCursor(state.rng));
  const enemy = battle.units.find((u) => u.faction === 'enemy');
  const hero = battle.units.find((u) => u.faction === 'party');
  if (!enemy || !hero) throw new Error('Missing fixture units');
  const budget: ThreatBudget = { ap: 4, move: 4, cooldowns: {}, statuses: [] };
  return { state, battle, enemy, hero, budget };
}

function openBattle(battle: BattleState, units: readonly Unit[]): BattleState {
  return {
    ...battle,
    units,
    props: [],
    grid: {
      ...battle.grid,
      tiles: battle.grid.tiles.map(() => ({
        terrain: 'dirt',
        elevation: 0,
        blocked: false,
        blocksSight: false,
        cover: false,
        surface: null,
      })),
    },
  };
}

describe('possible direct attack threats', () => {
  it('replaces old defender occupancy rather than leaving a ghost in the route', () => {
    const { battle, enemy, hero, budget } = fixture();
    const base = openBattle(battle, [
      { ...enemy, pos: { x: 2, y: 3 }, abilities: ['strike'] },
      { ...hero, pos: { x: 3, y: 3 } },
    ]);
    const corridor = {
      ...base,
      grid: {
        ...base.grid,
        tiles: base.grid.tiles.map((t, i) => ({
          ...t,
          blocked: Math.floor(i / base.grid.width) !== 3,
        })),
      },
    };
    expect(
      directAttackThreats(CONTENT, corridor, enemy.id, hero.id, budget, { x: 6, y: 3 }),
    ).toMatchObject({ valid: true, threats: [{ abilityId: 'strike', moveCost: 3 }] });
    expect(corridor.units.find((u) => u.id === hero.id)?.pos).toEqual({ x: 3, y: 3 });
  });

  it('does not cut a blocked diagonal to reach an attack origin', () => {
    const { battle, enemy, hero, budget } = fixture();
    const base = openBattle(battle, [
      { ...enemy, pos: { x: 2, y: 2 }, abilities: ['strike'] },
      { ...hero, pos: { x: 4, y: 4 } },
    ]);
    const trapped = {
      ...base,
      grid: {
        ...base.grid,
        tiles: base.grid.tiles.map((t, i) =>
          i === 2 * base.grid.width + 3 || i === 3 * base.grid.width + 2
            ? { ...t, blocked: true }
            : t,
        ),
      },
    };
    expect(
      directAttackThreats(CONTENT, base, enemy.id, hero.id, { ...budget, move: 1 }),
    ).toMatchObject({ valid: true, threats: [{ abilityId: 'strike' }] });
    expect(
      directAttackThreats(CONTENT, trapped, enemy.id, hero.id, { ...budget, move: 1 }),
    ).toEqual({ valid: true, threats: [] });
  });

  it('finds the gate off-target splash on the plank but not the cell before it, without mutations', () => {
    const { state, battle, enemy, hero, budget } = fixture();
    const before = structuredClone({ state, battle, budget });
    expect(directAttackThreats(CONTENT, battle, enemy.id, hero.id, budget, { x: 4, y: 3 })).toEqual(
      { valid: true, threats: [] },
    );
    const result = directAttackThreats(CONTENT, battle, enemy.id, hero.id, budget, { x: 5, y: 3 });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    const witness = result.threats.find((t) => t.abilityId === 'fire_blast');
    expect(witness).toBeDefined();
    if (!witness) return;
    expect(witness.aim).not.toEqual({ x: 5, y: 3 });
    expect(witness.moveCost).toBeLessThanOrEqual(4);
    const ability = CONTENT.abilities.get(witness.abilityId);
    if (!ability) throw new Error('Missing ability');
    const caster = { ...enemy, ...budget, pos: witness.origin };
    expect(isValidTarget(CONTENT, battle, caster, ability, witness.aim).ok).toBe(true);
    expect(affectedTiles(battle.grid, caster, ability, witness.aim).map(posKey)).toContain('5,3');
    expect({ state, battle, budget }).toEqual(before);
  });

  it('honors an opaque wall while cover alone does not remove threat', () => {
    const { battle, enemy, hero, budget } = fixture();
    const caster = { ...enemy, pos: { x: 3, y: 3 }, abilities: ['fire_blast'] };
    const target = { ...hero, pos: { x: 7, y: 3 } };
    const open = openBattle(battle, [caster, target]);
    const covered = {
      ...open,
      grid: { ...open.grid, tiles: open.grid.tiles.map((t) => ({ ...t, cover: true })) },
    };
    expect(
      directAttackThreats(CONTENT, covered, caster.id, target.id, { ...budget, move: 0 }),
    ).toMatchObject({ valid: true, threats: [{ abilityId: 'fire_blast' }] });
    const wall = {
      ...open,
      grid: {
        ...open.grid,
        tiles: open.grid.tiles.map((t, i) =>
          i % open.grid.width === 5 ? { ...t, blocked: true, blocksSight: true } : t,
        ),
      },
    };
    expect(
      directAttackThreats(CONTENT, wall, caster.id, target.id, { ...budget, move: 0 }),
    ).toEqual({ valid: true, threats: [] });
  });

  it('uses the supplied AP, cooldown and status snapshot rather than depleted live AP', () => {
    const { battle, enemy, hero, budget } = fixture();
    const projected = openBattle(battle, [
      { ...enemy, ap: 0, pos: { x: 3, y: 3 }, abilities: ['fire_blast'] },
      { ...hero, pos: { x: 6, y: 3 } },
    ]);
    const query = (b: ThreatBudget) =>
      directAttackThreats(CONTENT, projected, enemy.id, hero.id, b);
    expect(query({ ...budget, move: 0 })).toMatchObject({
      valid: true,
      threats: [{ abilityId: 'fire_blast' }],
    });
    expect(query({ ...budget, ap: 1 })).toEqual({ valid: true, threats: [] });
    expect(query({ ...budget, cooldowns: { fire_blast: 1 } })).toEqual({
      valid: true,
      threats: [],
    });
    expect(query({ ...budget, statuses: [{ id: 'chiBlocked', duration: 1, stacks: 1 }] })).toEqual({
      valid: true,
      threats: [],
    });
  });

  it('counts the far cell of a two-cell defender and rejects overlapping destinations', () => {
    const { battle, enemy, hero, budget } = fixture();
    const projected = openBattle(battle, [
      { ...enemy, pos: { x: 13, y: 3 }, abilities: ['rock_throw'] },
      { ...hero, size: 2, pos: { x: 7, y: 3 } },
    ]);
    const result = directAttackThreats(CONTENT, projected, enemy.id, hero.id, {
      ...budget,
      move: 0,
    });
    expect(result).toMatchObject({
      valid: true,
      threats: [{ affectedDefenderCells: [{ x: 8, y: 3 }] }],
    });
    expect(
      directAttackThreats(CONTENT, projected, enemy.id, hero.id, budget, { x: 12, y: 3 }).valid,
    ).toBe(false);
  });

  it('does not squeeze a two-cell attacker through a one-cell opening', () => {
    const { battle, enemy, hero, budget } = fixture();
    const base = openBattle(battle, [
      { ...enemy, size: 2, pos: { x: 2, y: 3 }, abilities: ['strike'] },
      { ...hero, pos: { x: 8, y: 3 } },
    ]);
    // Horizontal corridor has room for a wide unit; vertical slit has not.
    const grid = {
      ...base.grid,
      tiles: base.grid.tiles.map((t, i) =>
        Math.floor(i / base.grid.width) === 5 && i % base.grid.width !== 5
          ? { ...t, blocked: true }
          : t,
      ),
    };
    const units = base.units.map((u) =>
      u.id === enemy.id ? { ...u, pos: { x: 4, y: 3 } } : { ...u, pos: { x: 5, y: 7 } },
    );
    const blocked = { ...base, grid, units };
    expect(
      directAttackThreats(CONTENT, blocked, enemy.id, hero.id, { ...budget, move: 4 }),
    ).toEqual({ valid: true, threats: [] });
    const narrow = {
      ...blocked,
      units: units.map((u) => (u.id === enemy.id ? { ...u, size: 1 as const } : u)),
    };
    expect(directAttackThreats(CONTENT, narrow, enemy.id, hero.id, budget)).toMatchObject({
      valid: true,
      threats: [{ abilityId: 'strike' }],
    });
  });
});
