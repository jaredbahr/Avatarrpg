import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { BattleDraft } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import type { Grid, Unit, Vec2 } from '../types';
import { positionScore, weightsFor } from './ai';
import { DEFAULT_TILE, withTile } from './grid';

/**
 * Cover in the AI's position score (A-2).
 *
 * The damage side has required half a big unit's footprint (rounded up) since
 * the square geometry landed; the position scorer used to award the full cover
 * bonus for a single covered cell, so the AI would happily park a 2x2 with one
 * corner behind a rock and price it as fully shielded. These tests pin the
 * shared rule, and the anchor-alone rule the shipped gate-off AI was tuned on.
 */

function openGrid(width = 6, height = 6): Grid {
  return { width, height, tiles: Array.from({ length: width * height }, () => DEFAULT_TILE) };
}

function coverAt(grid: Grid, pos: Vec2): Grid {
  const tile = grid.tiles[pos.y * grid.width + pos.x];
  if (!tile) throw new Error(`off-grid cover tile ${pos.x},${pos.y}`);
  return withTile(grid, pos, { ...tile, cover: true });
}

/**
 * A size-2 enemy anchored at (1,1) — cells (1,1), (2,1), (1,2), (2,2) — facing
 * a lone hero at (4,1), so the fight is in reach and `positionScore` reads the
 * cover term rather than bailing out to "just close the distance".
 */
function fixture(grid: Grid, square: boolean): { draft: BattleDraft; unit: Unit } {
  const state = createGame(CONTENT, {
    seed: 'ai-cover-2x2',
    party: [{ characterId: 'kaya', level: 3, autoChoose: true }],
    startNode: '',
  });
  const seeded = createBattle(CONTENT, state, 'enc_quarry_gate', new RngCursor(state.rng));
  const hero = seeded.units.find((candidate) => candidate.faction === 'party');
  const enemy = seeded.units.find((candidate) => candidate.faction === 'enemy');
  if (!hero || !enemy) throw new Error('missing cover fixture units');

  const anchor: Vec2 = { x: 1, y: 1 };
  const units: Unit[] = [
    { ...enemy, pos: anchor, size: 2, ai: 'cautious' },
    { ...hero, pos: { x: 4, y: 1 } },
  ];
  const leader = units[0];
  if (!leader) throw new Error('missing fixture unit');

  const draft = new BattleDraft(
    CONTENT,
    {
      ...seeded,
      grid,
      units,
      order: units.map((unit) => unit.id),
      turnIndex: 0,
      props: [],
    },
    new RngCursor(0xc0de),
    { squareFootprints: square },
  );
  const unit = draft.unit(leader.id);
  if (!unit) throw new Error('missing fixture unit');
  return { draft, unit };
}

function score(grid: Grid, pos: Vec2, square: boolean): number {
  const { draft, unit } = fixture(grid, square);
  // Reach 6 keeps the hero (three tiles off) inside the fight, so cover is the
  // only term these grids move.
  return positionScore(draft, unit, pos, weightsFor('cautious'), 6, square);
}

describe('square 2x2 cover in the AI position score', () => {
  const anchor: Vec2 = { x: 1, y: 1 };
  const flat = openGrid();
  const weights = weightsFor('cautious');

  it('pays no cover bonus for a single covered cell of four', () => {
    const one = coverAt(flat, { x: 2, y: 1 });
    expect(score(one, anchor, true)).toBe(score(flat, anchor, true));
  });

  it('pays the cover bonus once half the footprint is covered', () => {
    const two = coverAt(coverAt(flat, { x: 2, y: 1 }), { x: 1, y: 2 });
    expect(score(two, anchor, true)).toBe(score(flat, anchor, true) + weights.cover);
  });

  it('still reads the anchor alone with the square gate off', () => {
    const anchorCover = coverAt(flat, anchor);
    const trailingCover = coverAt(flat, { x: 2, y: 1 });
    expect(score(anchorCover, anchor, false)).toBe(score(flat, anchor, false) + weights.cover);
    expect(score(trailingCover, anchor, false)).toBe(score(flat, anchor, false));
  });

  it('counts a right/lower footprint edge when deciding whether it is in reach', () => {
    // The anchor is three tiles from the hero, but the square's right edge is
    // two tiles away. The latter is within this unit's reach.
    expect(score(flat, { x: 1, y: 2 }, true)).toBe(-1);
  });
});
