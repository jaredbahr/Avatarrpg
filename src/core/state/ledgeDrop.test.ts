import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { previewAbility, resolveAbility } from '../rules/abilities';
import { tileAt, withTile } from '../rules/grid';
import type { BattleState, Grid, Unit, Vec2 } from '../types';
import { BattleDraft } from './battleDraft';
import { createBattle, createGame } from './createGame';

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
  });

  it('floors ledge damage at 1 HP and ignores defense', () => {
    const { battle, caster, victim } = fixture();
    const start = { x: 6, y: 5 };
    const positioned = elevated(
      placed(battle, { [caster.id]: { x: 5, y: 5 }, [victim.id]: start }),
      { '6,5': 1, '8,5': 0 },
    );
    const draft = new BattleDraft(CONTENT, positioned, new RngCursor(7));
    draft.replace({ ...victim, pos: start, hp: 2, base: { ...victim.base, defense: 999 } });
    draft.shove(victim.id, { x: 5, y: 5 }, 2, 'push');
    expect(draft.unit(victim.id)?.hp).toBe(1);
    expect(draft.events.some((event) => event.type === 'unitDied')).toBe(false);
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

  it('forecasts the same ledge damage as resolution without consuming live RNG', () => {
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
});
