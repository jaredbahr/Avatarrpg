import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { createBattle, createGame } from '../state/createGame';
import type { Grid, Unit, Vec2 } from '../types';
import { DEFAULT_TILE, withSurface } from './grid';
import { obscurementFor } from './obscurement';

const STEAM = { id: 'steam', duration: 2, spread: 0 } as const;

function fixture(): { attacker: Unit; defender: Unit } {
  const state = createGame(CONTENT, {
    seed: 'footprint-obscurement',
    party: [{ characterId: 'kaya', level: 3 }],
    startNode: '',
  });
  const battle = createBattle(CONTENT, state, 'enc_quarry_gate', new RngCursor(state.rng));
  const attacker = battle.units.find((unit) => unit.faction === 'party');
  const defender = battle.units.find((unit) => unit.faction === 'enemy');
  if (!attacker || !defender) throw new Error('missing obscurement fixture units');
  return { attacker, defender };
}

function openGrid(width = 8, height = 6): Grid {
  return { width, height, tiles: Array.from({ length: width * height }, () => DEFAULT_TILE) };
}

function steam(grid: Grid, cells: readonly Vec2[]): Grid {
  let next = grid;
  for (const cell of cells) next = withSurface(next, cell, STEAM);
  return next;
}

function at(unit: Unit, pos: Vec2): Unit {
  return { ...unit, pos };
}

describe('2x2 obscurement', () => {
  it('counts a block as inside a cloud only when every cell is obscured', () => {
    const { attacker, defender } = fixture();
    const big: Unit = { ...at(defender, { x: 4, y: 0 }), size: 2 };
    const shooter = at(attacker, { x: 0, y: 0 });

    const partial = steam(openGrid(), [
      { x: 4, y: 0 },
      { x: 5, y: 0 },
      { x: 4, y: 1 },
    ]);
    expect(obscurementFor(CONTENT, partial, shooter, big, 0, true).inside).toBe(0);

    const whole = steam(openGrid(), [
      { x: 4, y: 0 },
      { x: 5, y: 0 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
    ]);
    expect(obscurementFor(CONTENT, whole, shooter, big, 0, true).inside).toBe(-25);
  });

  it('keeps the legacy 2x1 reading while the gate is off', () => {
    const { attacker, defender } = fixture();
    const big: Unit = { ...at(defender, { x: 4, y: 0 }), size: 2 };
    const shooter = at(attacker, { x: 0, y: 0 });
    const twoCells = steam(openGrid(), [
      { x: 4, y: 0 },
      { x: 5, y: 0 },
    ]);

    expect(obscurementFor(CONTENT, twoCells, shooter, big, 0, false).inside).toBe(-25);
    // The same two clouded cells leave three of a 2x2's four cells clear.
    expect(obscurementFor(CONTENT, twoCells, shooter, big, 0, true).inside).toBe(0);
  });
});
