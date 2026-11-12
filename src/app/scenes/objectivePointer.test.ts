import { describe, expect, it } from 'vitest';
import { objectivePointerPlacement, resolveObjectivePointerTarget } from './objectivePointer';

describe('off-screen objective pointer placement', () => {
  it.each([
    [{ x: 500, y: -20 }, 'north'],
    [{ x: 1_020, y: 300 }, 'east'],
    [{ x: 500, y: 620 }, 'south'],
    [{ x: -20, y: 300 }, 'west'],
  ] as const)('places an off-screen target on the %s edge', (target, side) => {
    const placement = objectivePointerPlacement(target, 1_000, 600);
    expect(placement?.side).toBe(side);
    expect(placement?.x).toBeGreaterThanOrEqual(32);
    expect(placement?.x).toBeLessThanOrEqual(968);
    expect(placement?.y).toBeGreaterThanOrEqual(32);
    expect(placement?.y).toBeLessThanOrEqual(568);
  });

  it('keeps a diagonal target inside both inset edges', () => {
    const placement = objectivePointerPlacement({ x: 1_020, y: -40 }, 1_000, 600);
    expect(placement?.side).toBe('north');
    expect(placement?.x).toBeGreaterThan(909);
    expect(placement?.x).toBeLessThan(911);
    expect(placement?.y).toBe(32);
    expect(placement?.angle).toBeLessThan(180);
  });

  it.each([
    [{ x: 100, y: 100 }, 1_000, 600],
    [{ x: 0, y: 0 }, 1_000, 600],
    [{ x: 120, y: -1 }, 64, 64],
    [{ x: Number.NaN, y: 0 }, 1_000, 600],
  ] as const)('hides for visible, invalid, or too-small targets', (target, width, height) => {
    expect(objectivePointerPlacement(target, width, height)).toBeNull();
  });

  it('uses the drawn resident position and hides when an authored npc is absent', () => {
    const actor = {
      id: 'resident.elder_mira',
      npcId: 'elder_mira',
      name: 'Elder Mira',
      pos: { x: 8, y: 7 },
      renderPos: { x: 9, y: 7 },
      sprite: 'npc.elder',
    };
    expect(
      resolveObjectivePointerTarget({ kind: 'npc', id: 'elder_mira' }, undefined, [actor]),
    ).toEqual({ pos: { x: 9, y: 7 }, label: 'Elder Mira' });
    expect(
      resolveObjectivePointerTarget({ kind: 'npc', id: 'elder_mira' }, undefined, []),
    ).toBeNull();
    expect(
      resolveObjectivePointerTarget({ kind: 'npc', id: 'elder_mira' }, undefined, [
        { ...actor, alpha: 0 },
      ]),
    ).toBeNull();
    expect(
      resolveObjectivePointerTarget({ kind: 'npc', id: 'elder_mira' }, undefined, [
        { ...actor, quiet: true },
      ]),
    ).toBeNull();
  });

  it('resolves an authored route even while the exit condition keeps it locked', () => {
    const exit = {
      pos: { x: 19, y: 4 },
      toMapId: 'quarry_gate',
      toPos: { x: 1, y: 5 },
      label: 'East → Quarry Gate',
      requires: { kind: 'visited', nodeId: 'after_forest' } as const,
    };
    expect(
      resolveObjectivePointerTarget({ kind: 'exit', toMapId: 'quarry_gate' }, [exit], []),
    ).toEqual({
      pos: { x: 19, y: 4 },
      label: 'East → Quarry Gate',
    });
    expect(
      resolveObjectivePointerTarget({ kind: 'exit', toMapId: 'missing' }, [exit], []),
    ).toBeNull();
  });
});
