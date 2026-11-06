import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { BattleDraft } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import type { Ability, BattleState, Grid, Unit, UnitSize, Vec2 } from '../types';
import { previewAbility, resolveAbility } from './abilities';
import { hasCover, hitBreakdown, hitChance, screenCellFor } from './damage';
import { DEFAULT_TILE, distance, lineBetween, tileAt, withSurface, withTile } from './grid';

/**
 * Cover between the attacker and the defender (ADR 0105).
 *
 * A ranged shot takes the cover penalty when the cell beside the defender that
 * the sight line passes through holds a cover tile, a sight-blocking tile or
 * another living character. These pin the geometry, the characters, the 2x2
 * boss, the rules that stay as they were, and the preview against the roll.
 */

function openGrid(width = 8, height = 8): Grid {
  return { width, height, tiles: Array.from({ length: width * height }, () => DEFAULT_TILE) };
}

function place(
  grid: Grid,
  pos: Vec2,
  changes: { elevation?: number; cover?: boolean; blocksSight?: boolean; blocked?: boolean },
): Grid {
  const current = tileAt(grid, pos);
  if (!current) throw new Error(`Off-grid tile ${pos.x},${pos.y}`);
  return withTile(grid, pos, { ...current, ...changes });
}

function fixture(): { party: Unit; enemy: Unit; other: Unit; battle: BattleState } {
  const state = createGame(CONTENT, {
    seed: 'cover-between',
    party: [
      { characterId: 'kaya', level: 3, autoChoose: true },
      { characterId: 'tenzo', level: 3, autoChoose: true },
    ],
    startNode: '',
  });
  const battle = createBattle(CONTENT, state, 'enc_quarry_gate', new RngCursor(state.rng));
  const partyUnits = battle.units.filter((unit) => unit.faction === 'party');
  const enemy = battle.units.find((unit) => unit.faction === 'enemy');
  const [party, other] = partyUnits;
  if (!party || !other || !enemy) throw new Error('Missing cover-between fixture units');
  return { party, enemy, other, battle };
}

function at(unit: Unit, pos: Vec2, size: UnitSize = unit.size): Unit {
  return { ...unit, pos, size };
}

const { party, enemy, other, battle: baseBattle } = fixture();
/** The attacker, the defender and a bystander, each with a distinct id. */
const shooter = (pos: Vec2, size: UnitSize = 1) => at(party, pos, size);
const target = (pos: Vec2, size: UnitSize = 1) => at(enemy, pos, size);
const bystander = (pos: Vec2, size: UnitSize = 1) => at(other, pos, size);
const foeBystander = (pos: Vec2) => ({ ...at(enemy, pos, 1), id: 'enemy-bystander' });

function cover(grid: Grid, attacker: Unit, defender: Unit, units: readonly Unit[] = []): number {
  return hitBreakdown(CONTENT, grid, attacker, defender, 0, null, true, units).cover;
}

describe('the screen cell', () => {
  it('is the last cell of the sight line, always beside the defender', () => {
    expect(screenCellFor({ x: 0, y: 2 }, { x: 4, y: 2 })).toEqual({ x: 3, y: 2 });
    expect(screenCellFor({ x: 2, y: 6 }, { x: 2, y: 1 })).toEqual({ x: 2, y: 2 });
    expect(screenCellFor({ x: 0, y: 0 }, { x: 3, y: 3 })).toEqual({ x: 2, y: 2 });
    expect(screenCellFor({ x: 5, y: 0 }, { x: 1, y: 4 })).toEqual({ x: 2, y: 3 });
    // A shallow angle ends orthogonally beside the defender.
    expect(screenCellFor({ x: 0, y: 0 }, { x: 4, y: 2 })).toEqual({ x: 3, y: 2 });
    for (let x = 0; x < 7; x++) {
      for (let y = 0; y < 7; y++) {
        const cell = { x, y };
        const from = { x: 3, y: 3 };
        const screen = screenCellFor(from, cell);
        if (distance(from, cell) <= 1) {
          expect(screen).toBeNull();
          continue;
        }
        expect(screen).toEqual(lineBetween(from, cell).at(-1));
        expect(screen && distance(screen, cell)).toBe(1);
      }
    }
  });
});

describe('cover from props and walls between', () => {
  const from = { x: 0, y: 2 };
  const to = { x: 4, y: 2 };

  it('costs the cover penalty when a cover tile stands on the line beside the defender', () => {
    const grid = place(openGrid(), { x: 3, y: 2 }, { cover: true });
    expect(cover(grid, shooter(from), target(to))).toBe(-20);
    expect(hitChance(CONTENT, grid, shooter(from), target(to))).toBe(70);
  });

  it('ignores cover beside the defender but off the line, and cover beside the attacker', () => {
    expect(
      cover(place(openGrid(), { x: 3, y: 1 }, { cover: true }), shooter(from), target(to)),
    ).toBe(0);
    expect(
      cover(place(openGrid(), { x: 5, y: 2 }, { cover: true }), shooter(from), target(to)),
    ).toBe(0);
    expect(
      cover(place(openGrid(), { x: 1, y: 2 }, { cover: true }), shooter(from), target(to)),
    ).toBe(0);
  });

  it('counts the middle cell of a two-tile shot', () => {
    const grid = place(openGrid(), { x: 1, y: 2 }, { cover: true });
    expect(cover(grid, shooter(from), target({ x: 2, y: 2 }))).toBe(-20);
  });

  it('reads a diagonal shot through the diagonal neighbour, never the two corners', () => {
    const defender = target({ x: 3, y: 3 });
    const attacker = shooter({ x: 0, y: 0 });
    expect(cover(place(openGrid(), { x: 2, y: 2 }, { cover: true }), attacker, defender)).toBe(-20);
    // Both corners filled: the line slips between them, exactly as sight does.
    const corners = place(
      place(openGrid(), { x: 2, y: 3 }, { cover: true }),
      { x: 3, y: 2 },
      { cover: true },
    );
    expect(cover(corners, attacker, defender)).toBe(0);
  });

  it('counts a cover surface such as rubble between', () => {
    const grid = withSurface(openGrid(), { x: 3, y: 2 }, { id: 'rubble', duration: -1, spread: 0 });
    expect(cover(grid, shooter(from), target(to))).toBe(-20);
  });

  it('counts a sight-blocking wall between, at any height', () => {
    const grid = place(openGrid(), { x: 3, y: 2 }, { blocked: true, blocksSight: true });
    expect(cover(grid, shooter(from), target(to))).toBe(-20);
    const raised = place(grid, to, { elevation: 1 });
    expect(cover(raised, shooter(from), target(to))).toBe(-20);
  });

  it('gives a blocking cover prop beside the defender its cover', () => {
    const battle: BattleState = {
      ...baseBattle,
      grid: openGrid(),
      props: [],
      units: [shooter(from), target(to)],
    };
    const draft = new BattleDraft(CONTENT, battle, new RngCursor(2));
    expect(draft.placeProp('water_barrel', { x: 3, y: 2 })).toBeDefined();
    expect(cover(draft.grid, shooter(from), target(to))).toBe(-20);
  });

  it('does not count a screen standing lower than the defender', () => {
    const grid = place(place(openGrid(), { x: 3, y: 2 }, { cover: true }), to, { elevation: 1 });
    expect(cover(grid, shooter(from), target(to))).toBe(0);
    const level = place(grid, { x: 3, y: 2 }, { elevation: 1 });
    expect(cover(level, shooter(from), target(to))).toBe(-20);
  });
});

describe('characters as cover', () => {
  const from = { x: 0, y: 2 };
  const to = { x: 4, y: 2 };
  const attacker = shooter(from);
  const defender = target(to);

  it("screens with the attacker's ally as much as with the defender's", () => {
    expect(
      cover(openGrid(), attacker, defender, [attacker, defender, bystander({ x: 3, y: 2 })]),
    ).toBe(-20);
    expect(
      cover(openGrid(), attacker, defender, [attacker, defender, foeBystander({ x: 3, y: 2 })]),
    ).toBe(-20);
  });

  it('gives the same penalty as a cover prop, and never twice', () => {
    const units = [attacker, defender, bystander({ x: 3, y: 2 })];
    const prop = place(openGrid(), { x: 3, y: 2 }, { cover: true });
    expect(hitBreakdown(CONTENT, openGrid(), attacker, defender, 0, null, true, units)).toEqual(
      hitBreakdown(CONTENT, prop, attacker, defender),
    );
    const inCover = place(openGrid(), to, { cover: true });
    expect(cover(inCover, attacker, defender, units)).toBe(-20);
  });

  it('ignores a character off the line, a dead one, and the attacker itself', () => {
    expect(
      cover(openGrid(), attacker, defender, [attacker, defender, bystander({ x: 3, y: 1 })]),
    ).toBe(0);
    const fallen = { ...bystander({ x: 3, y: 2 }), hp: 0 };
    expect(cover(openGrid(), attacker, defender, [attacker, defender, fallen])).toBe(0);
    // A two-tile shot from the attacker's far cell runs over its own near cell.
    const big = shooter({ x: 1, y: 2 }, 2);
    const units = [big, target({ x: 4, y: 2 })];
    expect(
      hitBreakdown(CONTENT, openGrid(), big, target({ x: 4, y: 2 }), 0, { x: 2, y: 2 }, true, units)
        .cover,
    ).toBe(0);
  });

  it('measures from the firing cell', () => {
    const units = [attacker, defender, bystander({ x: 4, y: 3 })];
    // From straight above the bystander is behind the defender; from below it is in front.
    const above = hitBreakdown(
      CONTENT,
      openGrid(),
      shooter({ x: 4, y: 0 }),
      defender,
      0,
      null,
      true,
      units,
    );
    const below = hitBreakdown(
      CONTENT,
      openGrid(),
      shooter({ x: 4, y: 6 }),
      defender,
      0,
      null,
      true,
      units,
    );
    expect(above.cover).toBe(0);
    expect(below.cover).toBe(-20);
  });
});

describe('the 2x2 boss', () => {
  const from = { x: 0, y: 1 };

  it('is covered once half its cells are screened', () => {
    // Lines from (0,1) reach (3,1) past (2,1) and (3,2) past (2,2); the far
    // column is screened only by the boss's own near column, which never counts.
    const boss = target({ x: 3, y: 1 }, 2);
    const attacker = shooter(from);
    expect(cover(openGrid(), attacker, boss, [attacker, boss, bystander({ x: 2, y: 1 })])).toBe(0);
    expect(
      cover(openGrid(), attacker, boss, [
        attacker,
        boss,
        bystander({ x: 2, y: 1 }),
        foeBystander({ x: 2, y: 2 }),
      ]),
    ).toBe(-20);
    const half = place(
      place(openGrid(), { x: 2, y: 1 }, { cover: true }),
      { x: 2, y: 2 },
      {
        cover: true,
      },
    );
    expect(hasCover(CONTENT, half, boss, true)).toBe(false);
    expect(hasCover(CONTENT, half, boss, true, { origin: from, attacker, units: [] })).toBe(true);
  });

  it('screens a defender with any of its cells', () => {
    const boss = { ...bystander({ x: 2, y: 1 }, 2) };
    const attacker = shooter({ x: 0, y: 2 });
    const defender = target({ x: 4, y: 2 });
    expect(cover(openGrid(), attacker, defender, [attacker, defender, boss])).toBe(-20);
  });
});

describe('what cover-between leaves alone', () => {
  it('ignores cover in melee', () => {
    const attacker = shooter({ x: 2, y: 2 });
    const defender = target({ x: 3, y: 2 });
    const grid = place(openGrid(), { x: 3, y: 2 }, { cover: true });
    expect(cover(grid, attacker, defender, [attacker, defender, bystander({ x: 4, y: 2 })])).toBe(
      0,
    );
  });

  it('still halves the penalty for plunging fire and adds elevation', () => {
    const attacker = shooter({ x: 0, y: 2 });
    const defender = target({ x: 4, y: 2 });
    const grid = place(openGrid(), { x: 0, y: 2 }, { elevation: 1 });
    const breakdown = hitBreakdown(CONTENT, grid, attacker, defender, 0, null, true, [
      attacker,
      defender,
      bystander({ x: 3, y: 2 }),
    ]);
    expect(breakdown).toMatchObject({ chance: 90, elevation: 10, cover: -20, plunging: 10 });
  });
});

describe('the preview and the roll', () => {
  const throwRock = CONTENT.abilities.get('rock_throw') as Ability;

  function scene(blockerHp: number): { battle: BattleState; caster: Unit; victim: Unit } {
    const caster = shooter({ x: 1, y: 2 });
    const victim = target({ x: 5, y: 2 });
    const blocker = { ...bystander({ x: 4, y: 2 }), hp: blockerHp };
    const units = [caster, victim, blocker];
    return {
      battle: {
        ...baseBattle,
        grid: openGrid(),
        props: [],
        units,
        order: units.map((unit) => unit.id),
      },
      caster,
      victim,
    };
  }

  function rolled(battle: BattleState, caster: Unit, victim: Unit): number | undefined {
    const draft = new BattleDraft(CONTENT, battle, new RngCursor(1));
    const probabilities: number[] = [];
    const spy = {
      chance: (probability: number) => {
        probabilities.push(probability);
        return false;
      },
      range: (min: number) => min,
    } as unknown as RngCursor;
    const live = draft.unit(caster.id);
    if (!live) throw new Error('caster missing from draft');
    resolveAbility(draft, live, throwRock, victim.pos, spy);
    return probabilities[0];
  }

  it('shows the chance the reducer rolls, with a character between', () => {
    const { battle, caster, victim } = scene(20);
    const row = previewAbility(CONTENT, battle, caster, throwRock, victim.pos).targets.find(
      (t) => t.unitId === victim.id,
    );
    expect(row?.hitBreakdown?.cover).toBe(-20);
    expect(row?.hitChance).toBe(70);
    expect(rolled(battle, caster, victim)).toBe(0.7);
  });

  it('agrees when the character between has fallen', () => {
    const { battle, caster, victim } = scene(0);
    const row = previewAbility(CONTENT, battle, caster, throwRock, victim.pos).targets.find(
      (t) => t.unitId === victim.id,
    );
    expect(row?.hitChance).toBe(90);
    expect(rolled(battle, caster, victim)).toBe(0.9);
  });

  it('consumes no RNG to preview', () => {
    const { battle, caster, victim } = scene(20);
    const before = JSON.stringify(battle);
    previewAbility(CONTENT, battle, caster, throwRock, victim.pos);
    expect(JSON.stringify(battle)).toBe(before);
  });
});
