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
    expect(placement).toMatchObject({ side: 'east', x: 968, y: 32 });
    expect(placement?.angle).toBeCloseTo(Math.atan2(-72, 52));
  });

  it('keeps north and east cues clear of the map without leaving their edge', () => {
    const corner = { left: 840, bottom: 140 };
    const north = objectivePointerPlacement({ x: 940, y: -100 }, 1_000, 600, corner);
    const east = objectivePointerPlacement({ x: 1_120, y: -10 }, 1_000, 600, corner);
    expect(north).toMatchObject({ side: 'north', x: 808, y: 32 });
    expect(east).toMatchObject({ side: 'east', x: 968, y: 172 });
    expect(east?.angle).toBeCloseTo(Math.atan2(-182, 152));
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
    expect(resolveObjectivePointerTarget('elder_mira', undefined, [actor])).toEqual({
      pos: { x: 9, y: 7 },
      label: 'Elder Mira',
    });
    expect(resolveObjectivePointerTarget('elder_mira', undefined, [])).toBeNull();
    expect(
      resolveObjectivePointerTarget('elder_mira', undefined, [{ ...actor, alpha: 0 }]),
    ).toBeNull();
    expect(
      resolveObjectivePointerTarget('elder_mira', undefined, [{ ...actor, quiet: true }]),
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
    expect(resolveObjectivePointerTarget('quarry_gate', [exit], [])).toEqual({
      pos: { x: 19, y: 4 },
      label: 'East → Quarry Gate',
    });
    expect(resolveObjectivePointerTarget('missing', [exit], [])).toBeNull();
  });
});
