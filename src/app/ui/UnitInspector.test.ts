import { describe, expect, it } from 'vitest';
import type { Grid, Tile, Unit } from '../../core/types';
import { inspectorSyncDecision } from './Dialog';
import { unitFootingKey } from './UnitInspector';

const unit = { id: 'unit-1', hp: 4, pos: { x: 0, y: 0 }, size: 1 } as Unit;
const tile = (surface: string | null = null): Tile =>
  ({
    terrain: 'stone',
    elevation: 0,
    blocked: false,
    blocksSight: false,
    cover: false,
    surface: surface ? { id: surface, duration: 2, spread: 0 } : null,
  }) as Tile;
const grid = (...tiles: Tile[]): Grid => ({ width: 2, height: 1, tiles });

describe('unit inspector sync decision', () => {
  it('does not rebuild for the same unit reference', () => {
    const footing = unitFootingKey(unit, grid(tile(), tile()));
    expect(inspectorSyncDecision(unit, unit, footing, footing)).toBe('unchanged');
  });

  it('refreshes replacement state, including a fallen unit', () => {
    expect(inspectorSyncDecision(unit, { ...unit, hp: 0 })).toBe('refresh');
  });

  it('closes only when the unit no longer exists in the battle', () => {
    expect(inspectorSyncDecision(unit, undefined)).toBe('close');
  });

  it('refreshes when the surface under the same unit reference changes', () => {
    const before = unitFootingKey(unit, grid(tile(), tile()));
    const after = unitFootingKey(unit, grid(tile('fire'), tile()));
    expect(inspectorSyncDecision(unit, unit, before, after)).toBe('refresh');
  });

  it('does not rebuild when a surface elsewhere changes', () => {
    const before = unitFootingKey(unit, grid(tile(), tile()));
    const after = unitFootingKey(unit, grid(tile(), tile('fire')));
    expect(inspectorSyncDecision(unit, unit, before, after)).toBe('unchanged');
  });
});
