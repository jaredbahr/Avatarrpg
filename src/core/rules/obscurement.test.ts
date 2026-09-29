import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { createBattle, createGame } from '../state/createGame';
import type { ContentIndex, Grid, SurfaceDef, Unit, Vec2 } from '../types';
import { hitBreakdown, hitChance } from './damage';
import { DEFAULT_TILE, withSurface } from './grid';
import { NO_OBSCUREMENT, obscurementFor, weatherAt } from './obscurement';
import { describeFooting } from './reactions';

/**
 * Obscurement, pinned component by component.
 *
 * Steam used to be a hard line-of-sight block. These tests are the contract
 * that replaced it: you can always shoot into or through a cloud, the penalty
 * is data (surface magnitudes in `content/surfaces.ts`, shared caps and the
 * weather curves in `content/tuning.ts`), and the `hitBreakdown` field shows
 * exactly where the miss chance came from.
 */

const STEAM = { id: 'steam', duration: 2, spread: 0 } as const;

function fixture(): { attacker: Unit; defender: Unit } {
  const state = createGame(CONTENT, {
    seed: 'obscurement',
    party: [{ characterId: 'kaya', level: 3 }],
    startNode: '',
  });
  const battle = createBattle(CONTENT, state, 'enc_quarry_gate', new RngCursor(state.rng));
  const attacker = battle.units.find((unit) => unit.faction === 'party');
  const defender = battle.units.find((unit) => unit.faction === 'enemy');
  if (!attacker || !defender) throw new Error('Missing fixture units');
  return { attacker, defender };
}

function openGrid(width = 8, height = 5): Grid {
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

describe('obscurement', () => {
  it('reads the steam magnitudes from the surface data', () => {
    const steamDef = CONTENT.surfaces.get('steam');
    if (!steamDef) throw new Error('Missing steam surface');
    expect(steamDef.obscures).toEqual({ inside: -25, through: -15 });
    expect(steamDef.blocksSight).toBe(false);
    expect(steamDef.grantsCover).toBe(false);
  });

  it('costs 25 when the target stands in a cloud', () => {
    const { attacker, defender } = fixture();
    const grid = steam(openGrid(), [{ x: 4, y: 0 }]);
    const breakdown = hitBreakdown(
      CONTENT,
      grid,
      at(attacker, { x: 0, y: 0 }),
      at(defender, { x: 4, y: 0 }),
    );
    expect(breakdown.obscurement).toEqual({
      inside: -25,
      through: 0,
      attacker: 0,
      weather: 0,
      total: -25,
    });
    expect(breakdown.chance).toBe(65);
  });

  it('counts a cloud crossed once, however many tiles it spans', () => {
    const { attacker, defender } = fixture();
    const grid = steam(openGrid(), [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
    const breakdown = hitBreakdown(
      CONTENT,
      grid,
      at(attacker, { x: 0, y: 0 }),
      at(defender, { x: 4, y: 0 }),
    );
    expect(breakdown.obscurement).toEqual({
      inside: 0,
      through: -15,
      attacker: 0,
      weather: 0,
      total: -15,
    });
    expect(breakdown.chance).toBe(75);
  });

  it('costs the through value when the attacker is the one in the cloud', () => {
    const { attacker, defender } = fixture();
    const grid = steam(openGrid(), [{ x: 0, y: 0 }]);
    const breakdown = hitBreakdown(
      CONTENT,
      grid,
      at(attacker, { x: 0, y: 0 }),
      at(defender, { x: 4, y: 0 }),
    );
    expect(breakdown.obscurement).toEqual({
      inside: 0,
      through: 0,
      attacker: -15,
      weather: 0,
      total: -15,
    });
    expect(breakdown.chance).toBe(75);
  });

  it('stacks inside and through, and clamps at the obscurement cap', () => {
    const { attacker, defender } = fixture();
    const grid = steam(openGrid(), [
      { x: 2, y: 0 },
      { x: 4, y: 0 },
    ]);
    const attackerUnit = at(attacker, { x: 0, y: 0 });
    const defenderUnit = at(defender, { x: 4, y: 0 });

    const stacked = hitBreakdown(CONTENT, grid, attackerUnit, defenderUnit);
    expect(stacked.obscurement).toEqual({
      inside: -25,
      through: -15,
      attacker: 0,
      weather: 0,
      total: -40,
    });
    expect(stacked.chance).toBe(50);

    // Weather stacks on top of the cloud and still cannot pass the cap.
    const capped = hitBreakdown(CONTENT, grid, attackerUnit, defenderUnit, 2);
    expect(capped.obscurement.weather).toBeLessThan(0);
    expect(capped.obscurement.total).toBe(-40);
    expect(capped.chance).toBe(50);
  });

  it('flattens adjacent attacks to -10 when either side is in a cloud', () => {
    const { attacker, defender } = fixture();
    const attackerUnit = at(attacker, { x: 0, y: 0 });
    const defenderUnit = at(defender, { x: 1, y: 0 });

    const defenderCloud = steam(openGrid(), [{ x: 1, y: 0 }]);
    expect(hitBreakdown(CONTENT, defenderCloud, attackerUnit, defenderUnit).obscurement).toEqual({
      inside: 0,
      through: 0,
      attacker: 0,
      weather: 0,
      total: -10,
    });

    const attackerCloud = steam(openGrid(), [{ x: 0, y: 0 }]);
    expect(hitBreakdown(CONTENT, attackerCloud, attackerUnit, defenderUnit).chance).toBe(80);

    // Adjacent attacks ignore weather entirely.
    const clear = hitBreakdown(CONTENT, openGrid(), attackerUnit, defenderUnit, 2);
    expect(clear.obscurement).toEqual(NO_OBSCUREMENT);
    expect(clear.chance).toBe(90);
  });

  it('leaves the defender clear when a size-2 unit is only half in the cloud', () => {
    const { attacker, defender } = fixture();
    const big: Unit = { ...at(defender, { x: 4, y: 0 }), size: 2 };
    const attackerUnit = at(attacker, { x: 0, y: 0 });

    const half = hitBreakdown(CONTENT, steam(openGrid(), [{ x: 4, y: 0 }]), attackerUnit, big);
    expect(half.obscurement.total).toBe(0);

    const whole = hitBreakdown(
      CONTENT,
      steam(openGrid(), [
        { x: 4, y: 0 },
        { x: 5, y: 0 },
      ]),
      attackerUnit,
      big,
    );
    expect(whole.obscurement.inside).toBe(-25);
    expect(whole.obscurement.total).toBe(-25);
  });

  it('applies no obscurement on clear ground', () => {
    const { attacker, defender } = fixture();
    const breakdown = hitBreakdown(
      CONTENT,
      openGrid(),
      at(attacker, { x: 0, y: 0 }),
      at(defender, { x: 4, y: 0 }),
    );
    expect(breakdown.obscurement).toEqual(NO_OBSCUREMENT);
    expect(
      obscurementFor(
        CONTENT,
        openGrid(),
        at(attacker, { x: 0, y: 0 }),
        at(defender, { x: 4, y: 0 }),
        0,
      ),
    ).toEqual(NO_OBSCUREMENT);
  });

  it('builds the weather curve from the tuning table by distance', () => {
    const { attacker, defender } = fixture();
    const grid = openGrid(9, 5);
    const attackerUnit = at(attacker, { x: 0, y: 0 });
    const penaltiesAt = (weather: 0 | 1 | 2) =>
      [1, 2, 3, 4, 5, 6].map(
        (d) =>
          hitBreakdown(CONTENT, grid, attackerUnit, at(defender, { x: d, y: 0 }), weather)
            .obscurement.weather,
      );

    expect(penaltiesAt(1)).toEqual([0, 0, -5, -10, -15, -20]);
    expect(penaltiesAt(2)).toEqual([0, -10, -20, -30, -40, -40]);
    expect(penaltiesAt(0)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('feeds weather into the same total the hit chance uses', () => {
    const { attacker, defender } = fixture();
    const attackerUnit = at(attacker, { x: 0, y: 0 });
    const defenderUnit = at(defender, { x: 5, y: 0 });
    const breakdown = hitBreakdown(CONTENT, openGrid(8, 5), attackerUnit, defenderUnit, 1);
    expect(breakdown.obscurement.weather).toBe(-15);
    expect(breakdown.obscurement.total).toBe(-15);
    expect(breakdown.chance).toBe(
      hitChance(CONTENT, openGrid(8, 5), attackerUnit, defenderUnit, 1),
    );
    expect(breakdown.chance).toBe(75);
  });

  it('resolves the weather schedule deterministically by round', () => {
    const encounter = CONTENT.encounters.get('enc_forest_road');
    if (!encounter) throw new Error('Missing forest road fixture');
    const storm: ContentIndex = {
      ...CONTENT,
      encounters: new Map(CONTENT.encounters).set('enc_forest_road', {
        ...encounter,
        weather: {
          id: 'sandstorm',
          schedule: [
            { fromRound: 3, intensity: 1 },
            { fromRound: 6, intensity: 2 },
          ],
        },
      }),
    };

    expect(
      [1, 2, 3, 4, 5, 6, 7].map((round) => weatherAt(storm, 'enc_forest_road', round)),
    ).toEqual([0, 0, 1, 1, 1, 2, 2]);
    // The same call answers the same way every time (no hidden state).
    expect(weatherAt(storm, 'enc_forest_road', 7)).toBe(2);
    // An encounter with no authored weather, or an unknown id, is clear.
    expect(weatherAt(CONTENT, 'enc_forest_road', 7)).toBe(0);
    expect(weatherAt(storm, 'no_such_encounter', 7)).toBe(0);

    // Out-of-order entries still resolve to the latest applicable round.
    const shuffled: ContentIndex = {
      ...storm,
      encounters: new Map(CONTENT.encounters).set('enc_forest_road', {
        ...encounter,
        weather: {
          id: 'sandstorm',
          schedule: [
            { fromRound: 6, intensity: 2 },
            { fromRound: 3, intensity: 1 },
          ],
        },
      }),
    };
    expect(weatherAt(shuffled, 'enc_forest_road', 4)).toBe(1);
    expect(weatherAt(shuffled, 'enc_forest_road', 9)).toBe(2);
  });

  it('describes footing from the data, not from prose', () => {
    const steamDef = CONTENT.surfaces.get('steam');
    if (!steamDef?.obscures) throw new Error('Missing steam obscurement');
    const penalty = (value: number) => (value < 0 ? `−${Math.abs(value)}` : `+${value}`);
    const expected =
      `${penalty(steamDef.obscures.inside)} to hit anyone inside, ` +
      `${penalty(steamDef.obscures.through)} to shoot through`;
    const line = describeFooting(CONTENT, 'steam');
    expect(line).toContain(expected);
    expect(line.endsWith('.')).toBe(true);

    // Moving the numbers moves the sentence.
    const retuned: SurfaceDef = { ...steamDef, obscures: { inside: -7, through: -3 } };
    const tuned: ContentIndex = {
      ...CONTENT,
      surfaces: new Map(CONTENT.surfaces).set('steam', retuned),
    };
    expect(describeFooting(tuned, 'steam')).toContain(
      `${penalty(retuned.obscures!.inside)} to hit anyone inside, ` +
        `${penalty(retuned.obscures!.through)} to shoot through`,
    );
    expect(describeFooting(CONTENT, 'rubble')).not.toContain('to shoot through');
  });
});
