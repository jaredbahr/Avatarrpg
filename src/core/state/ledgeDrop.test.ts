import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { previewAbility, resolveAbility } from '../rules/abilities';
import { tileAt, withSurface, withTile } from '../rules/grid';
import type { BattleState, Grid, Unit, Vec2 } from '../types';
import { BattleDraft } from './battleDraft';
import { createBattle, createGame } from './createGame';
import { describeEvent } from './log';

function fixture(): { battle: BattleState; caster: Unit; victim: Unit } {
  const game = createGame(CONTENT, {
    seed: 'ledge-drop',
    party: [{ characterId: 'kaya', level: 3, autoChoose: true }],
    startNode: '',
  });
  const battle = createBattle(CONTENT, game, 'enc_quarry_gate', new RngCursor(game.rng));
  const caster = battle.units.find((unit) => unit.faction === 'party');
  const victim = battle.units.find((unit) => unit.faction === 'enemy');
  if (!caster || !victim) throw new Error('ledge fixture is missing units');
  return { battle, caster, victim };
}

function elevated(battle: BattleState, elevations: Readonly<Record<string, number>>): BattleState {
  let grid: Grid = battle.grid;
  for (const [key, elevation] of Object.entries(elevations)) {
    const [x, y] = key.split(',').map(Number);
    if (x === undefined || y === undefined) throw new Error(`invalid tile key ${key}`);
    const pos = { x, y };
    const tile = tileAt(grid, pos);
    if (!tile) throw new Error(`missing tile ${key}`);
    grid = withTile(grid, pos, { ...tile, elevation });
  }
  return { ...battle, grid };
}

function placed(battle: BattleState, positions: Readonly<Record<string, Vec2>>): BattleState {
  const units = battle.units
    .filter((unit) => positions[unit.id])
    .map((unit) => ({ ...unit, pos: positions[unit.id] as Vec2 }));
  return { ...battle, units, order: units.map((unit) => unit.id), turnIndex: 0 };
}

function shoveDraft(battle: BattleState, victim: Unit, to: Vec2): BattleDraft {
  const draft = new BattleDraft(CONTENT, battle, new RngCursor(7));
  draft.shove(victim.id, { x: victim.pos.x - 1, y: victim.pos.y }, 2, 'push');
  expect(draft.unit(victim.id)?.pos).toEqual(to);
  return draft;
}

describe('ledge drops', () => {
  it.each([
    [1, 3],
    [2, 6],
  ])('deals %i tier drop damage', (tiers, damage) => {
    const { battle, caster, victim } = fixture();
    const start = { x: 6, y: 5 };
    const landing = { x: start.x + 2, y: start.y };
    const positioned = elevated(
      placed(battle, { [caster.id]: { x: 5, y: 5 }, [victim.id]: start }),
      {
        [`${start.x},${start.y}`]: tiers,
        [`${landing.x},${landing.y}`]: 0,
      },
    );
    const draft = shoveDraft(positioned, { ...victim, pos: start }, landing);
    expect(draft.unit(victim.id)?.hp).toBe(victim.hp - damage);
    expect(draft.events).toContainEqual(
      expect.objectContaining({
        type: 'damaged',
        unitId: victim.id,
        amount: damage,
        cause: 'ledgeDrop',
      }),
    );
    const fall = draft.events.find(
      (event) => event.type === 'damaged' && event.cause === 'ledgeDrop',
    );
    if (!fall) throw new Error('missing ledge event');
    expect(describeEvent(CONTENT, draft.toBattle(), fall)).toBe(
      `${victim.name} falls from the ledge: ${damage} damage.`,
    );
  });

  it('reports only HP actually lost at the 1 HP floor', () => {
    const { battle, caster, victim } = fixture();
    const start = { x: 6, y: 5 };
    const positioned = elevated(
      placed(battle, { [caster.id]: { x: 5, y: 5 }, [victim.id]: start }),
      { '6,5': 1, '8,5': 0 },
    );
    const draft = new BattleDraft(CONTENT, positioned, new RngCursor(7));
    draft.replace({ ...victim, pos: start, hp: 2 });
    draft.shove(victim.id, { x: 5, y: 5 }, 2, 'push');
    expect(draft.unit(victim.id)?.hp).toBe(1);
    expect(draft.events).toContainEqual(
      expect.objectContaining({ type: 'damaged', cause: 'ledgeDrop', amount: 1 }),
    );
    expect(draft.events.some((event) => event.type === 'unitDied')).toBe(false);
  });

  it('records a harmless fall at 1 HP without a damage number', () => {
    const { battle, caster, victim } = fixture();
    const start = { x: 6, y: 5 };
    const positioned = elevated(
      placed(battle, { [caster.id]: { x: 5, y: 5 }, [victim.id]: start }),
      { '6,5': 1, '8,5': 0 },
    );
    const draft = new BattleDraft(CONTENT, positioned, new RngCursor(7));
    draft.replace({ ...victim, pos: start, hp: 1 });
    draft.shove(victim.id, { x: 5, y: 5 }, 2, 'push');
    const fall = draft.events.find(
      (event) => event.type === 'damaged' && event.cause === 'ledgeDrop',
    );
    expect(fall).toEqual(expect.objectContaining({ amount: 0 }));
    if (!fall) throw new Error('missing ledge event');
    expect(describeEvent(CONTENT, draft.toBattle(), fall)).toBe(
      `${victim.name} stumbles off the ledge.`,
    );
  });

  it('uses the worst occupied-cell drop once for a size-2 unit', () => {
    const { battle, caster, victim } = fixture();
    const start = { x: 6, y: 5 };
    const wide = { ...victim, size: 2 as const, pos: start };
    const positioned = elevated(
      placed(
        { ...battle, units: battle.units.map((unit) => (unit.id === victim.id ? wide : unit)) },
        {
          [caster.id]: { x: 4, y: 5 },
          [victim.id]: start,
        },
      ),
      { '6,5': 2, '7,5': 2, '8,5': 1, '9,5': 0 },
    );
    const draft = new BattleDraft(CONTENT, positioned, new RngCursor(7));
    draft.shove(victim.id, { x: 5, y: 5 }, 2, 'push');
    expect(draft.unit(victim.id)?.hp).toBe(victim.hp - 6);
    expect(draft.events.filter((event) => event.type === 'damaged')).toHaveLength(1);
  });

  it('lets a two-tier shove fall, but stops a shove up at the ledge', () => {
    const { battle, caster, victim } = fixture();
    const start = { x: 6, y: 5 };
    const base = placed(battle, { [caster.id]: { x: 5, y: 5 }, [victim.id]: start });
    const down = elevated(base, { '6,5': 2, '8,5': 0 });
    expect(
      shoveDraft(down, { ...victim, pos: start }, { x: 8, y: 5 }).unit(victim.id)?.pos,
    ).toEqual({ x: 8, y: 5 });
    const up = elevated(base, { '6,5': 0, '7,5': 1 });
    const draft = new BattleDraft(CONTENT, up, new RngCursor(7));
    draft.shove(victim.id, { x: 5, y: 5 }, 1, 'push');
    expect(draft.unit(victim.id)?.pos).toEqual(start);
  });

  it('applies the same ledge rules to a pull', () => {
    const { battle, caster, victim } = fixture();
    const start = { x: 8, y: 5 };
    const positioned = elevated(
      placed(battle, { [caster.id]: { x: 5, y: 5 }, [victim.id]: start }),
      { '8,5': 2, '7,5': 0 },
    );
    const draft = new BattleDraft(CONTENT, positioned, new RngCursor(7));
    draft.shove(victim.id, { x: 6, y: 5 }, 1, 'pull');
    expect(draft.unit(victim.id)?.pos).toEqual({ x: 7, y: 5 });
    expect(draft.events).toContainEqual(
      expect.objectContaining({ type: 'damaged', cause: 'ledgeDrop', amount: 6 }),
    );
  });

  it.each(['up', 'down'] as const)('allows a shove %s a one-tier ramp without damage', (way) => {
    const { battle, caster, victim } = fixture();
    const start = { x: 6, y: 5 };
    const destination = { x: 7, y: 5 };
    const base = placed(battle, { [caster.id]: { x: 5, y: 5 }, [victim.id]: start });
    const fromTile = tileAt(base.grid, start);
    const toTile = tileAt(base.grid, destination);
    if (!fromTile || !toTile) throw new Error('ramp fixture is off-grid');
    let grid = withTile(base.grid, start, {
      ...fromTile,
      elevation: way === 'up' ? 0 : 1,
      ramp: way === 'down',
    });
    grid = withTile(grid, destination, {
      ...toTile,
      elevation: way === 'up' ? 1 : 0,
      ramp: way === 'up',
    });
    const draft = new BattleDraft(CONTENT, { ...base, grid }, new RngCursor(7));
    draft.shove(victim.id, { x: 5, y: 5 }, 1, 'push');
    expect(draft.unit(victim.id)?.pos).toEqual(destination);
    expect(
      draft.events.some((event) => event.type === 'damaged' && event.cause === 'ledgeDrop'),
    ).toBe(false);
  });

  it('deals full damage for a two-tier fall when either end is a ramp', () => {
    const { battle, caster, victim } = fixture();
    const start = { x: 6, y: 5 };
    const destination = { x: 7, y: 5 };
    const base = placed(battle, { [caster.id]: { x: 5, y: 5 }, [victim.id]: start });
    for (const rampAt of [start, destination]) {
      let grid = base.grid;
      for (const [pos, elevation] of [
        [start, 2],
        [destination, 0],
      ] as const) {
        const tile = tileAt(grid, pos);
        if (!tile) throw new Error('ramp fixture is off-grid');
        grid = withTile(grid, pos, { ...tile, elevation, ramp: pos === rampAt });
      }
      const draft = new BattleDraft(CONTENT, { ...base, grid }, new RngCursor(7));
      draft.shove(victim.id, { x: 5, y: 5 }, 1, 'push');
      expect(draft.events).toContainEqual(
        expect.objectContaining({ type: 'damaged', cause: 'ledgeDrop', amount: 6 }),
      );
    }
  });

  it('does not add a drop event after the landing surface defeats the unit', () => {
    const { battle, caster, victim } = fixture();
    const start = { x: 6, y: 5 };
    const landing = { x: 8, y: 5 };
    let positioned = elevated(placed(battle, { [caster.id]: { x: 5, y: 5 }, [victim.id]: start }), {
      '6,5': 1,
      '8,5': 0,
    });
    positioned = {
      ...positioned,
      grid: withSurface(positioned.grid, landing, { id: 'fire', duration: 2, spread: 0 }),
      units: positioned.units.map((unit) => (unit.id === victim.id ? { ...unit, hp: 1 } : unit)),
    };
    const draft = shoveDraft(positioned, { ...victim, pos: start, hp: 1 }, landing);
    expect(draft.unit(victim.id)?.hp).toBe(0);
    expect(draft.events.some((event) => event.type === 'unitDied')).toBe(true);
    expect(
      draft.events.some((event) => event.type === 'damaged' && event.cause === 'ledgeDrop'),
    ).toBe(false);
  });

  it('lets a prop fall two tiers without taking damage', () => {
    const { battle } = fixture();
    const start = { x: 6, y: 5 };
    const positioned = elevated({ ...battle, units: [], order: [] }, { '6,5': 2, '7,5': 0 });
    const draft = new BattleDraft(CONTENT, positioned, new RngCursor(7));
    const prop = draft.placeProp('water_barrel', start);
    if (!prop) throw new Error('prop not placed');
    draft.shoveProp(prop.id, { x: 5, y: 5 }, 1, 'push');
    expect(draft.props.find((entry) => entry.id === prop.id)?.pos).toEqual({ x: 7, y: 5 });
    expect(draft.props.find((entry) => entry.id === prop.id)?.hp).toBe(prop.hp);
  });

  it('applies ledge damage to a unit pushed by a breaking prop', () => {
    const { battle, victim } = fixture();
    const cart = { x: 6, y: 5 };
    const start = { x: 7, y: 5 };
    const positioned = elevated(placed(battle, { [victim.id]: start }), {
      '7,5': 2,
      '8,5': 0,
    });
    const draft = new BattleDraft(CONTENT, positioned, new RngCursor(7));
    const prop = draft.placeProp('cabbage_cart', cart);
    if (!prop) throw new Error('cart not placed');
    draft.breakProp(prop.id);
    expect(draft.unit(victim.id)?.pos).toEqual({ x: 8, y: 5 });
    expect(draft.events).toContainEqual(
      expect.objectContaining({ type: 'damaged', cause: 'ledgeDrop', amount: 6 }),
    );
  });

  it('forecasts the nominal pre-hit drop when hit damage does not change the floor outcome', () => {
    const { battle, caster, victim } = fixture();
    const start = { x: 6, y: 5 };
    const positioned = elevated(
      placed(battle, { [caster.id]: { x: 5, y: 5 }, [victim.id]: start }),
      { '6,5': 1, '8,5': 0 },
    );
    const ability = CONTENT.abilities.get('air_blast');
    if (!ability) throw new Error('air_blast missing');
    const before = JSON.stringify(positioned);
    const preview = previewAbility(CONTENT, positioned, caster, ability, start);
    const shove = preview.shoves.find((entry) => entry.id === victim.id);
    expect(shove?.ledgeDropDamage).toBe(3);
    expect(JSON.stringify(positioned)).toBe(before);
    const draft = new BattleDraft(CONTENT, positioned, new RngCursor(7));
    resolveAbility(draft, draft.unit(caster.id) ?? caster, ability, start, draft.rng);
    expect(
      draft.events.find(
        (event) =>
          event.type === 'damaged' && event.unitId === victim.id && event.cause === 'ledgeDrop',
      ),
    ).toEqual(expect.objectContaining({ amount: shove?.ledgeDropDamage, cause: 'ledgeDrop' }));
  });

  it('forecasts summed drops while skipping a one-tier ramp step', () => {
    const { battle, caster, victim } = fixture();
    const start = { x: 6, y: 5 };
    const wide = { ...victim, size: 2 as const, pos: start };
    const positioned = placed(
      {
        ...battle,
        units: battle.units.map((unit) => (unit.id === victim.id ? wide : unit)),
      },
      { [caster.id]: { x: 5, y: 5 }, [victim.id]: start },
    );
    let grid = positioned.grid;
    for (const [pos, elevation, ramp] of [
      [start, 2, true],
      [{ x: 7, y: 5 }, 1, false],
      [{ x: 8, y: 5 }, 2, true],
      [{ x: 9, y: 5 }, 0, false],
    ] as const) {
      const tile = tileAt(grid, pos);
      if (!tile) throw new Error('ledge fixture is off-grid');
      grid = withTile(grid, pos, { ...tile, elevation, ramp });
    }
    const ability = CONTENT.abilities.get('air_blast');
    if (!ability) throw new Error('air_blast missing');
    const preview = previewAbility(CONTENT, { ...positioned, grid }, caster, ability, start);
    const shove = preview.shoves.find((entry) => entry.id === victim.id);
    expect(shove?.ledgeDropTiers).toBe(2);
    expect(shove?.ledgeDropDamage).toBe(6);
  });
});
