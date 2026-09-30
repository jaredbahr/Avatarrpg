import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { createBattle, createGame } from '../state/createGame';
import type { Grid, Unit, UnitSize, Vec2 } from '../types';
import { hasCover } from './damage';
import { DEFAULT_TILE, withTile } from './grid';

/**
 * Cover for a big unit (A-2).
 *
 * A 2x2 is covered once at least half its footprint (rounded up) is — 2 of 4.
 * The legacy 2x1 needs 1 of 2, and a size-1 unit needs its single cell, so the
 * gate-off numbers are unchanged.
 */

function openGrid(width = 6, height = 6): Grid {
  return { width, height, tiles: Array.from({ length: width * height }, () => DEFAULT_TILE) };
}

function baseUnit(): Unit {
  const state = createGame(CONTENT, {
    seed: 'cover-footprint',
    party: [{ characterId: 'kaya', level: 3, autoChoose: true }],
    startNode: '',
  });
  const battle = createBattle(CONTENT, state, 'enc_quarry_gate', new RngCursor(state.rng));
  const unit = battle.units.find((candidate) => candidate.faction === 'party');
  if (!unit) throw new Error('missing cover fixture unit');
  return unit;
}

function at(unit: Unit, pos: Vec2, size: UnitSize = 1): Unit {
  return { ...unit, pos, size };
}

function coverAt(grid: Grid, pos: Vec2): Grid {
  const tile = grid.tiles[pos.y * grid.width + pos.x];
  if (!tile) throw new Error(`off-grid cover tile ${pos.x},${pos.y}`);
  return withTile(grid, pos, { ...tile, cover: true });
}

describe('big-unit cover', () => {
  const unit = baseUnit();
  const flat = openGrid();

  it('keeps the legacy 2x1 rule: one covered cell of two is enough', () => {
    const grid = coverAt(flat, { x: 2, y: 1 });
    expect(hasCover(CONTENT, grid, at(unit, { x: 1, y: 1 }, 2))).toBe(true);
    expect(hasCover(CONTENT, flat, at(unit, { x: 1, y: 1 }, 2))).toBe(false);
  });

  it('needs two covered cells of four on the square 2x2', () => {
    const one = coverAt(flat, { x: 2, y: 1 });
    const two = coverAt(one, { x: 1, y: 2 });
    expect(hasCover(CONTENT, flat, at(unit, { x: 1, y: 1 }, 2), true)).toBe(false);
    expect(hasCover(CONTENT, one, at(unit, { x: 1, y: 1 }, 2), true)).toBe(false);
    expect(hasCover(CONTENT, two, at(unit, { x: 1, y: 1 }, 2), true)).toBe(true);
  });

  it('still needs the single cell of a size-1 unit', () => {
    const covered = coverAt(flat, { x: 1, y: 1 });
    expect(hasCover(CONTENT, flat, at(unit, { x: 1, y: 1 }), true)).toBe(false);
    expect(hasCover(CONTENT, covered, at(unit, { x: 1, y: 1 }), true)).toBe(true);
  });
});
