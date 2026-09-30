import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { BattleDraft } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import type { Ability, BattleState, Grid, Unit, UnitSize, Vec2 } from '../types';
import { previewAbility, resolveAbility, resolveAim } from './abilities';
import { DEFAULT_TILE, withTile } from './grid';

/**
 * Aiming at a big unit (A-2).
 *
 * A 2x2 body fills four cells; a player taps whichever corner the pointer is
 * over. `resolveAim` snaps that tap to the first footprint cell the caster can
 * actually reach and see, and `resolveAbility` must strike the same body the
 * preview promised even when the tap was not the anchor.
 */

/** Flat ground, so the only thing under test is the aim geometry. */
function openGrid(width = 12, height = 12): Grid {
  return { width, height, tiles: Array.from({ length: width * height }, () => DEFAULT_TILE) };
}

/** A unit-target attack with an explicit range and line-of-sight rule. */
function unitAttack(range: number, requiresLineOfSight: boolean): Ability {
  return {
    id: 'test_aim_strike',
    name: 'Test strike',
    element: 'air',
    apCost: 1,
    cooldown: 0,
    range,
    minRange: 0,
    requiresLineOfSight,
    targeting: { shape: 'unit', allow: 'enemy' },
    effects: [{ kind: 'damage', base: 7, scale: 0, damageType: 'air', ignoreDefense: true }],
    tags: ['attack'],
    description: '',
    flavor: '',
    fx: 'fx.none',
  };
}

/** A caster and one enemy on an otherwise empty board, each with full HP. */
function placed(
  casterPos: Vec2,
  casterSize: UnitSize,
  bossPos: Vec2,
  bossSize: UnitSize,
  grid: Grid = openGrid(),
): { battle: BattleState; caster: Unit; boss: Unit } {
  const state = createGame(CONTENT, {
    seed: 'a2-aim',
    party: [{ characterId: 'kaya', level: 3, autoChoose: true }],
    startNode: '',
  });
  const seeded = createBattle(CONTENT, state, 'enc_quarry_gate', new RngCursor(state.rng));
  const casterBase = seeded.units.find((unit) => unit.faction === 'party');
  const bossBase = seeded.units.find((unit) => unit.faction === 'enemy');
  if (!casterBase || !bossBase) throw new Error('missing aim fixture units');

  const units: Unit[] = [
    {
      ...casterBase,
      pos: casterPos,
      size: casterSize,
      hp: 40,
      base: { ...casterBase.base, maxHp: 40 },
    },
    { ...bossBase, pos: bossPos, size: bossSize, hp: 40, base: { ...bossBase.base, maxHp: 40 } },
  ];
  const caster = units[0];
  const boss = units[1];
  if (!caster || !boss) throw new Error('missing placed units');

  return {
    battle: {
      ...seeded,
      grid,
      units,
      order: units.map((unit) => unit.id),
      turnIndex: 0,
      props: [],
      temporaryWalls: [],
    },
    caster,
    boss,
  };
}

describe('resolveAim', () => {
  it('snaps a tap on any footprint cell to the first cell in range', () => {
    const { battle, caster } = placed({ x: 6, y: 3 }, 1, { x: 6, y: 1 }, 2);
    const ability = unitAttack(1, false);

    // Footprint order is anchor, right, below, below-right; only the front
    // (lower) cells are within one tile of a caster standing at (6,3).
    expect(resolveAim(CONTENT, battle, caster, ability, { x: 6, y: 1 }, true)).toEqual({
      x: 6,
      y: 2,
    });
    expect(resolveAim(CONTENT, battle, caster, ability, { x: 7, y: 2 }, true)).toEqual({
      x: 6,
      y: 2,
    });
    expect(resolveAim(CONTENT, battle, caster, ability, { x: 6, y: 2 }, true)).toEqual({
      x: 6,
      y: 2,
    });
  });

  it('snaps past a blocked anchor to the first visible footprint cell', () => {
    const grid = withTile(openGrid(), { x: 5, y: 1 }, { ...DEFAULT_TILE, blocksSight: true });
    const { battle, caster } = placed({ x: 1, y: 1 }, 1, { x: 8, y: 1 }, 2, grid);
    const ability = unitAttack(10, true);

    // The wall at (5,1) hides the top row of the block, but the line to the
    // lower-left cell passes below it.
    expect(resolveAim(CONTENT, battle, caster, ability, { x: 8, y: 1 }, true)).toEqual({
      x: 8,
      y: 2,
    });
    expect(resolveAim(CONTENT, battle, caster, ability, { x: 9, y: 1 }, true)).toEqual({
      x: 8,
      y: 2,
    });
  });

  it('reads the block the active gate describes', () => {
    const { battle, caster } = placed({ x: 1, y: 1 }, 1, { x: 8, y: 1 }, 2);
    const ability = unitAttack(10, false);

    // (9,2) is only part of the body under the square gate.
    expect(resolveAim(CONTENT, battle, caster, ability, { x: 9, y: 2 }, true)).toEqual({
      x: 8,
      y: 1,
    });
    expect(resolveAim(CONTENT, battle, caster, ability, { x: 9, y: 2 }, false)).toEqual({
      x: 9,
      y: 2,
    });
  });

  it('leaves a tap untouched when no footprint cell is aimable', () => {
    const { battle, caster } = placed({ x: 1, y: 1 }, 1, { x: 8, y: 1 }, 2);
    const ability = unitAttack(1, false);

    expect(resolveAim(CONTENT, battle, caster, ability, { x: 8, y: 2 }, true)).toEqual({
      x: 8,
      y: 2,
    });
    expect(resolveAim(CONTENT, battle, caster, ability, { x: 4, y: 4 }, true)).toEqual({
      x: 4,
      y: 4,
    });
  });
});

describe('2x2 resolve parity', () => {
  it('hits the body the preview showed when the tap is a non-anchor cell', () => {
    const { battle, caster, boss } = placed({ x: 1, y: 1 }, 1, { x: 6, y: 1 }, 2);
    const ability = unitAttack(10, false);
    const tapped: Vec2 = { x: 7, y: 2 };
    const draft = new BattleDraft(CONTENT, battle, new RngCursor(7), { squareFootprints: true });

    const preview = previewAbility(CONTENT, draft.toBattle(), caster, ability, tapped, true);
    expect(preview.tiles).toEqual([tapped]);
    expect(preview.targets.find((target) => target.unitId === boss.id)?.damage).toBe(7);

    // Force the to-hit roll to land and decline the crit, so the only variance
    // left is the damage formula both paths share.
    let draws = 0;
    const rng = {
      chance: () => draws++ === 0,
      range: () => 1,
      int: () => 0,
    } as unknown as RngCursor;

    resolveAbility(draft, caster, ability, tapped, rng);
    expect(draft.unit(boss.id)?.hp).toBe(boss.hp - 7);
  });
});
