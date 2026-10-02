import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { createBattle, createGame } from '../state/createGame';
import type { Ability, Grid, Unit } from '../types';
import { validatingOrigin } from './abilities';
import { DEFAULT_TILE } from './grid';

const reach: Ability = {
  id: 'test_footprint_reach',
  name: 'Test reach',
  element: 'earth',
  apCost: 1,
  cooldown: 0,
  range: 6,
  minRange: 0,
  requiresLineOfSight: true,
  targeting: { shape: 'tile' },
  effects: [],
  tags: ['attack'],
  description: '',
  flavor: '',
  fx: 'fx.none',
};

function openGrid(width = 10, height = 10): Grid {
  return { width, height, tiles: Array.from({ length: width * height }, () => DEFAULT_TILE) };
}

function caster(): Unit {
  const game = createGame(CONTENT, {
    seed: 'footprint-origin',
    party: [{ characterId: 'kaya', level: 3, autoChoose: true }],
    startNode: '',
  });
  const battle = createBattle(CONTENT, game, 'enc_quarry_gate', new RngCursor(game.rng));
  const found = battle.units.find((unit) => unit.faction === 'party');
  if (!found) throw new Error('missing origin caster');
  return { ...found, pos: { x: 2, y: 2 }, size: 2 };
}

describe('2x2 caster origin', () => {
  it('fires from the footprint cell nearest the target', () => {
    const origin = validatingOrigin(
      CONTENT,
      openGrid(),
      caster(),
      reach,
      { x: 6, y: 6 },
      true,
      true,
    );
    expect(origin).toEqual({ x: 3, y: 3 });
  });

  it('keeps anchor-first order for the legacy 2x1', () => {
    const origin = validatingOrigin(
      CONTENT,
      openGrid(),
      caster(),
      reach,
      { x: 6, y: 6 },
      true,
      false,
    );
    expect(origin).toEqual({ x: 2, y: 2 });
  });

  it('is unchanged for a size-1 caster', () => {
    const unit: Unit = { ...caster(), size: 1 };
    const origin = validatingOrigin(CONTENT, openGrid(), unit, reach, { x: 6, y: 6 }, true, true);
    expect(origin).toEqual({ x: 2, y: 2 });
  });
});
