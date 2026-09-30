import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { BattleDraft } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import type { Grid, Unit, UnitSize, Vec2 } from '../types';
import { ledgeExposure } from './ai';
import { DEFAULT_TILE, withTile } from './grid';

/**
 * Square-footprint AI (A-2).
 *
 * The strict wall that stops a 2x2 being knocked off a non-ramp ledge has to
 * reach the position scorer too, or the AI pays for a fall the shove cannot
 * deal. The legacy 2x1 and a size-1 unit keep their exposure.
 */

/** Flat ground with a one-tier plateau across the first three columns. */
function plateauGrid(width = 6, height = 6): Grid {
  let grid: Grid = {
    width,
    height,
    tiles: Array.from({ length: width * height }, () => DEFAULT_TILE),
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x <= 2; x++) {
      grid = withTile(grid, { x, y }, { ...DEFAULT_TILE, elevation: 1 });
    }
  }
  return grid;
}

/** One party target on the lip and one adjacent enemy that knows Shove. */
function fixture(
  size: UnitSize,
  unitPos: Vec2,
  casterPos: Vec2,
  square: boolean,
): { draft: BattleDraft; unit: Unit } {
  const state = createGame(CONTENT, {
    seed: `ai-footprint-${size}-${square}`,
    party: [{ characterId: 'kaya', level: 3, autoChoose: true }],
    startNode: '',
  });
  const seeded = createBattle(CONTENT, state, 'enc_forest_road', new RngCursor(state.rng));
  const party = seeded.units.find((candidate) => candidate.faction === 'party');
  const enemy = seeded.units.find((candidate) => candidate.faction === 'enemy');
  if (!party || !enemy) throw new Error('missing ledge fixture units');

  const units: Unit[] = [
    { ...party, pos: unitPos, size },
    {
      ...enemy,
      pos: casterPos,
      size: 1,
      ai: 'aggressive',
      abilities: ['shove'],
      cooldowns: {},
      ap: 1,
      move: 0,
    },
  ];
  const leader = units[0];
  if (!leader) throw new Error('missing fixture unit');

  const draft = new BattleDraft(
    CONTENT,
    {
      ...seeded,
      grid: plateauGrid(),
      units,
      order: units.map((unit) => unit.id),
      turnIndex: 0,
      props: [],
      temporaryWalls: [],
    },
    new RngCursor(0x1ed),
    { squareFootprints: square },
  );
  const unit = draft.unit(leader.id);
  if (!unit) throw new Error('missing fixture unit');
  return { draft, unit };
}

describe('square 2x2 ledge exposure', () => {
  it('is zero for a square 2x2 standing on the lip', () => {
    const { draft, unit } = fixture(2, { x: 1, y: 0 }, { x: 0, y: 0 }, true);
    expect(ledgeExposure(draft, unit, { x: 1, y: 0 })).toBe(0);
  });

  it('still prices the legacy 2x1 and a size-1 unit on the same lip', () => {
    const legacy = fixture(2, { x: 1, y: 0 }, { x: 0, y: 0 }, false);
    expect(ledgeExposure(legacy.draft, legacy.unit, { x: 1, y: 0 })).toBeGreaterThan(0);

    const single = fixture(1, { x: 2, y: 0 }, { x: 1, y: 0 }, true);
    expect(ledgeExposure(single.draft, single.unit, { x: 2, y: 0 })).toBeGreaterThan(0);
  });
});
