import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { BattleDraft } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import type { Grid, Tile, Unit, Vec2 } from '../types';
import { planAiTurn } from './ai';
import { DEFAULT_TILE, distance, hasLineOfSight, withTile } from './grid';

/**
 * The AI and its own walls.
 *
 * A cautious bender used to raise `earth_wall` straight across its firing lane,
 * bank the terrain points, and then stand there with AP and no legal action for
 * the rest of the fight: the wall it paid for was blocking its own line of sight
 * to every enemy. The scorer now asks what a placement costs the caster and
 * refuses one that seals it off, unless the wall is actually hiding it from a
 * threat that can reach it right now.
 */

const WALL: Tile = {
  terrain: 'wall',
  elevation: 0,
  blocked: true,
  blocksSight: true,
  cover: false,
  surface: null,
};

function openGrid(width: number, height: number): Grid {
  return { width, height, tiles: Array.from({ length: width * height }, () => DEFAULT_TILE) };
}

/** A one-tile-wide corridor: the only line of sight runs along `y = 3`. */
function corridor(width: number, height: number): Grid {
  let grid = openGrid(width, height);
  for (let x = 0; x < width; x++) {
    grid = withTile(grid, { x, y: 2 }, WALL);
    grid = withTile(grid, { x, y: 4 }, WALL);
  }
  return grid;
}

function setup(options: {
  grid: Grid;
  casterPos: Vec2;
  casterAbilities: readonly string[];
  casterCooldowns: Readonly<Record<string, number>>;
  casterMove: number;
  enemies: readonly { pos: Vec2; abilities: readonly string[] }[];
}): { draft: BattleDraft; casterId: string; enemyIds: readonly string[] } {
  const state = createGame(CONTENT, {
    seed: 'ai-wall',
    party: [{ characterId: 'bo', level: 7, autoChoose: true }],
    startNode: '',
  });
  const battle = createBattle(CONTENT, state, 'enc_forest_road', new RngCursor(state.rng), {
    variantId: 'slingers',
  });
  const casterBase = battle.units.find((unit) => unit.faction === 'party');
  const enemyBase = battle.units.find((unit) => unit.faction === 'enemy');
  if (!casterBase || !enemyBase) throw new Error('Missing wall fixture units');

  const caster: Unit = {
    ...casterBase,
    pos: options.casterPos,
    ai: 'cautious',
    abilities: options.casterAbilities,
    cooldowns: options.casterCooldowns,
    ap: 4,
    move: options.casterMove,
  };
  const enemies: Unit[] = options.enemies.map((enemy, index) => ({
    ...enemyBase,
    id: `e${index}`,
    name: `Enemy ${index}`,
    pos: enemy.pos,
    abilities: enemy.abilities,
    cooldowns: {},
    ap: 4,
    move: 3,
  }));

  const units = [caster, ...enemies];
  const draft = new BattleDraft(
    CONTENT,
    {
      ...battle,
      grid: options.grid,
      units,
      order: units.map((unit) => unit.id),
      turnIndex: 0,
      props: [],
    },
    new RngCursor(0x5eed),
  );
  return { draft, casterId: caster.id, enemyIds: enemies.map((enemy) => enemy.id) };
}

/** Ids of every ability the unit actually spent AP on this turn. */
function usedAbilities(draft: BattleDraft): string[] {
  return draft.events
    .filter((event) => event.type === 'abilityUsed')
    .map((event) => (event.type === 'abilityUsed' ? event.abilityId : ''));
}

describe('the AI and its own walls', () => {
  it('does not wall off its only line of sight to a ranged enemy that cannot reach it', () => {
    /*
     * The Quarry Bender has already thrown (Rock Throw cooling) and the archer
     * across the corridor is out of its own range, so the only scored action is
     * the wall. Old behaviour: the bender raised it, lost sight of its single
     * enemy and stood there. The wall buys nothing defensively here.
     */
    const { draft, casterId, enemyIds } = setup({
      grid: corridor(12, 7),
      casterPos: { x: 2, y: 3 },
      casterAbilities: ['rock_throw', 'earth_wall'],
      casterCooldowns: { rock_throw: 5 },
      casterMove: 0,
      enemies: [{ pos: { x: 7, y: 3 }, abilities: ['flame_arc'] }],
    });
    const enemyId = enemyIds[0];
    if (!enemyId) throw new Error('Missing enemy');

    planAiTurn(draft, casterId, new RngCursor(7));

    const caster = draft.unit(casterId);
    const enemy = draft.unit(enemyId);
    if (!caster || !enemy) throw new Error('Fixture units vanished');
    expect(usedAbilities(draft)).toEqual([]);
    // The line it could not afford to lose is still open.
    expect(hasLineOfSight(draft.grid, caster.pos, enemy.pos)).toBe(true);
  });

  it('still walls when it breaks a live archer line while leaving a second target in view', () => {
    /*
     * The slinger flanking on the left can hit the caster right now, so the wall
     * has a defensive job. A second enemy stays in view on the right, so the
     * bender is not sealing itself out of the fight. Both halves matter.
     */
    const { draft, casterId, enemyIds } = setup({
      grid: openGrid(12, 9),
      casterPos: { x: 5, y: 4 },
      casterAbilities: ['rock_throw', 'earth_wall'],
      casterCooldowns: { rock_throw: 5 },
      casterMove: 0,
      enemies: [
        { pos: { x: 2, y: 4 }, abilities: ['sling_stone'] },
        { pos: { x: 9, y: 4 }, abilities: ['club_swing'] },
      ],
    });
    const archerId = enemyIds[0];
    const otherId = enemyIds[1];
    if (!archerId || !otherId) throw new Error('Missing enemies');

    planAiTurn(draft, casterId, new RngCursor(7));

    const caster = draft.unit(casterId);
    const archer = draft.unit(archerId);
    const other = draft.unit(otherId);
    if (!caster || !archer || !other) throw new Error('Fixture units vanished');
    expect(usedAbilities(draft)).toContain('earth_wall');
    expect(hasLineOfSight(draft.grid, archer.pos, caster.pos)).toBe(false);
    expect(hasLineOfSight(draft.grid, caster.pos, other.pos)).toBe(true);
    expect(distance(caster.pos, other.pos)).toBeLessThanOrEqual(5);
  });

  it('still raises a wall that does not seal the caster in', () => {
    // On an open field the bender can walk around a three-tile wall, so the
    // placement costs it no options and must not be refused.
    const { draft, casterId, enemyIds } = setup({
      grid: openGrid(12, 8),
      casterPos: { x: 2, y: 3 },
      casterAbilities: ['rock_throw', 'earth_wall'],
      casterCooldowns: { rock_throw: 5 },
      casterMove: 0,
      enemies: [{ pos: { x: 7, y: 3 }, abilities: ['flame_arc'] }],
    });
    const enemyId = enemyIds[0];
    if (!enemyId) throw new Error('Missing enemy');

    planAiTurn(draft, casterId, new RngCursor(7));

    expect(usedAbilities(draft)).toContain('earth_wall');
  });
});
