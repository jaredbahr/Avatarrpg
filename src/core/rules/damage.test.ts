import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { createBattle, createGame } from '../state/createGame';
import type { ContentIndex, Grid, Unit, Vec2 } from '../types';
import { hitBreakdown, hitChance } from './damage';
import { DEFAULT_TILE, tileAt, withTile } from './grid';
import { NO_OBSCUREMENT } from './obscurement';

/**
 * Hit chance, pinned number by number.
 *
 * The numbers themselves live in `content/tuning.ts`; these are the exact
 * chances the old literals in `damage.ts` produced, so a data edit that moves
 * gameplay fails here instead of quietly shifting the balance band.
 */

const ATTACKER = { x: 1, y: 1 };
const ADJACENT = { x: 2, y: 1 };
const RANGED = { x: 3, y: 1 };

function fixture(): { attacker: Unit; defender: Unit } {
  const state = createGame(CONTENT, {
    seed: 'hit-chance',
    party: [{ characterId: 'kaya', level: 3 }],
    startNode: '',
  });
  const battle = createBattle(CONTENT, state, 'enc_quarry_gate', new RngCursor(state.rng));
  const attacker = battle.units.find((unit) => unit.faction === 'party');
  const defender = battle.units.find((unit) => unit.faction === 'enemy');
  if (!attacker || !defender) throw new Error('Missing fixture units');
  return { attacker, defender };
}

/** 5x5 open ground, so a scenario can place anyone without leaving the grid. */
function openGrid(width = 5, height = 5): Grid {
  return { width, height, tiles: Array.from({ length: width * height }, () => DEFAULT_TILE) };
}

function place(grid: Grid, pos: Vec2, changes: { elevation?: number; cover?: boolean }): Grid {
  const current = tileAt(grid, pos);
  if (!current) throw new Error(`Off-grid tile ${pos.x},${pos.y}`);
  return withTile(grid, pos, { ...current, ...changes });
}

function at(unit: Unit, pos: Vec2): Unit {
  return { ...unit, pos };
}

describe('hit chance', () => {
  it('pins the authored tuning numbers', () => {
    expect(CONTENT.tuning).toEqual({
      baseHitChance: 90,
      elevationStep: 10,
      coverPenalty: 20,
      plungingCoverDivisor: 2,
      obscurementCap: 40,
      adjacentObscurementPenalty: 10,
      obscurementReference: 25,
      weather: [
        { perTile: 0, minDistance: 1, cap: 0 },
        { perTile: 5, minDistance: 3, cap: 20 },
        { perTile: 10, minDistance: 2, cap: 40 },
      ],
      hitChanceMin: 5,
      hitChanceMax: 99,
      climbCost: 1,
      heightReachBonus: 1,
      ledgeDropDamage: 3,
    });
  });

  it('gives an even, adjacent fight a flat 90%', () => {
    const { attacker, defender } = fixture();
    const breakdown = hitBreakdown(
      CONTENT,
      openGrid(),
      at(attacker, ATTACKER),
      at(defender, ADJACENT),
    );
    expect(breakdown).toEqual({
      chance: 90,
      base: 90,
      elevation: 0,
      cover: 0,
      plunging: 0,
      statuses: 0,
      obscurement: NO_OBSCUREMENT,
    });
  });

  it('adds a step for each tier of high ground and never passes 99', () => {
    const { attacker, defender } = fixture();
    const high = place(openGrid(), ATTACKER, { elevation: 2 });
    expect(hitChance(CONTENT, high, at(attacker, ATTACKER), at(defender, RANGED))).toBe(99);
  });

  it('takes a step back for attacking uphill', () => {
    const { attacker, defender } = fixture();
    const uphill = place(openGrid(), ADJACENT, { elevation: 1 });
    expect(hitChance(CONTENT, uphill, at(attacker, ATTACKER), at(defender, ADJACENT))).toBe(80);
  });

  it('costs 20 at range when the defender has cover', () => {
    const { attacker, defender } = fixture();
    const covered = place(openGrid(), RANGED, { cover: true });
    expect(hitBreakdown(CONTENT, covered, at(attacker, ATTACKER), at(defender, RANGED))).toEqual({
      chance: 70,
      base: 90,
      elevation: 0,
      cover: -20,
      plunging: 0,
      statuses: 0,
      obscurement: NO_OBSCUREMENT,
    });
  });

  it('ignores cover next to the defender, and stacks elevation onto cover', () => {
    const { attacker, defender } = fixture();
    const covered = place(openGrid(), ADJACENT, { cover: true });
    expect(hitChance(CONTENT, covered, at(attacker, ATTACKER), at(defender, ADJACENT))).toBe(90);

    const stacked = place(openGrid(), RANGED, { cover: true, elevation: 2 });
    expect(hitBreakdown(CONTENT, stacked, at(attacker, ATTACKER), at(defender, RANGED))).toEqual({
      chance: 50,
      base: 90,
      elevation: -20,
      cover: -20,
      plunging: 0,
      statuses: 0,
      obscurement: NO_OBSCUREMENT,
    });
  });

  it('halves cover only for a non-adjacent attacker above the defender', () => {
    const { attacker, defender } = fixture();
    const highAttacker = place(place(openGrid(), ATTACKER, { elevation: 1 }), RANGED, {
      cover: true,
    });
    expect(
      hitBreakdown(CONTENT, highAttacker, at(attacker, ATTACKER), at(defender, RANGED)),
    ).toEqual(expect.objectContaining({ cover: -20, plunging: 10, chance: 90 }));

    const equal = place(place(openGrid(), ATTACKER, { elevation: 1 }), RANGED, {
      cover: true,
      elevation: 1,
    });
    expect(hitBreakdown(CONTENT, equal, at(attacker, ATTACKER), at(defender, RANGED))).toEqual(
      expect.objectContaining({ cover: -20, plunging: 0 }),
    );

    const lower = place(place(openGrid(), ATTACKER, { elevation: 0 }), RANGED, {
      cover: true,
      elevation: 1,
    });
    expect(hitBreakdown(CONTENT, lower, at(attacker, ATTACKER), at(defender, RANGED))).toEqual(
      expect.objectContaining({ cover: -20, plunging: 0 }),
    );

    const adjacent = place(place(openGrid(), ATTACKER, { elevation: 1 }), ADJACENT, {
      cover: true,
    });
    expect(hitBreakdown(CONTENT, adjacent, at(attacker, ATTACKER), at(defender, ADJACENT))).toEqual(
      expect.objectContaining({ cover: 0, plunging: 0 }),
    );
  });

  it('treats a defender adjacent to a size-2 attacker cell as adjacent', () => {
    const { attacker, defender } = fixture();
    const highAttacker = place(place(openGrid(), ATTACKER, { elevation: 1 }), RANGED, {
      cover: true,
    });
    expect(
      hitBreakdown(
        CONTENT,
        highAttacker,
        at({ ...attacker, size: 2 }, ATTACKER),
        at(defender, RANGED),
      ),
    ).toEqual(expect.objectContaining({ cover: 0, plunging: 0 }));
  });

  it('reads the numbers from the index, so a variant can move them', () => {
    const { attacker, defender } = fixture();
    const uphill = place(openGrid(), ADJACENT, { elevation: 1 });
    const steep: ContentIndex = {
      ...CONTENT,
      tuning: { ...CONTENT.tuning, elevationStep: 25 },
    };
    expect(hitChance(steep, uphill, at(attacker, ATTACKER), at(defender, ADJACENT))).toBe(65);

    const soft: ContentIndex = { ...CONTENT, tuning: { ...CONTENT.tuning, baseHitChance: 0 } };
    expect(hitChance(soft, openGrid(), at(attacker, ATTACKER), at(defender, ADJACENT))).toBe(5);
  });
});
