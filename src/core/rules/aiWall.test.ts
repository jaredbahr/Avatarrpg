import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { BattleDraft, raisedWallTile } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import type { Grid, Tile, Unit, Vec2 } from '../types';
import { isValidTarget } from './abilities';
import { planAiTurn, wallStrandsCaster } from './ai';
import { DEFAULT_TILE, hasLineOfSight, tileAt, withTile } from './grid';

/**
 * The AI and its own walls.
 *
 * A cautious bender used to raise `earth_wall` straight across its firing lane,
 * bank the terrain points, and then stand there with AP and no legal action for
 * the rest of the fight. A placement is now refused when, from where the caster
 * *stands*, the post-wall ground holds no enemy a usable attack could still
 * reach — unless the wall is a real block, shutting down an attack that can hit
 * the caster next turn. Threats use next-turn AP and cooldowns, and the shared
 * direct-threat rule checks every occupied cell of a size-2 unit.
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

/** The grid exactly as `raiseWall` would leave it, for asserting against. */
function raised(grid: Grid, tiles: readonly Vec2[]): Grid {
  let out = grid;
  for (const pos of tiles) {
    const tile = tileAt(out, pos);
    if (!tile) continue;
    out = withTile(out, pos, raisedWallTile(tile));
  }
  return out;
}

interface Fixture {
  readonly draft: BattleDraft;
  readonly casterIds: readonly string[];
  readonly enemyIds: readonly string[];
}

function setup(options: {
  grid: Grid;
  casters: readonly {
    pos: Vec2;
    abilities: readonly string[];
    cooldowns?: Readonly<Record<string, number>>;
    move?: number;
    ap?: number;
    size?: 1 | 2;
  }[];
  enemies: readonly {
    pos: Vec2;
    abilities: readonly string[];
    cooldowns?: Readonly<Record<string, number>>;
    move?: number;
    ap?: number;
    size?: 1 | 2;
    defense?: number;
  }[];
}): Fixture {
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

  const casters: Unit[] = options.casters.map((caster, index) => ({
    ...casterBase,
    id: `c${index}`,
    name: `Caster ${index}`,
    pos: caster.pos,
    ai: 'cautious',
    abilities: caster.abilities,
    cooldowns: caster.cooldowns ?? {},
    ap: caster.ap ?? 4,
    move: caster.move ?? 0,
    size: caster.size ?? 1,
  }));
  const enemies: Unit[] = options.enemies.map((enemy, index) => ({
    ...enemyBase,
    id: `e${index}`,
    name: `Enemy ${index}`,
    pos: enemy.pos,
    abilities: enemy.abilities,
    cooldowns: enemy.cooldowns ?? {},
    ap: enemy.ap ?? 4,
    move: enemy.move ?? 0,
    size: enemy.size ?? 1,
    base: { ...enemyBase.base, defense: enemy.defense ?? enemyBase.base.defense },
  }));

  const units = [...casters, ...enemies];
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
  return {
    draft,
    casterIds: casters.map((unit) => unit.id),
    enemyIds: enemies.map((unit) => unit.id),
  };
}

type SetupOptions = Parameters<typeof setup>[0];

function unit(draft: BattleDraft, id: string | undefined): Unit {
  if (!id) throw new Error('Missing fixture unit id');
  const found = draft.unit(id);
  if (!found) throw new Error(`Missing unit ${id}`);
  return found;
}

function ability(id: string) {
  const found = CONTENT.abilities.get(id);
  if (!found) throw new Error(`Missing ability ${id}`);
  return found;
}

/** Ids of every ability the unit actually spent AP on this turn. */
function usedAbilities(draft: BattleDraft): string[] {
  return draft.events
    .filter((event) => event.type === 'abilityUsed')
    .map((event) => (event.type === 'abilityUsed' ? event.abilityId : ''));
}

/** The caster every rule fixture shares: rock cooling, only the wall to spend. */
function bender(pos: Vec2, extra: { move?: number } = {}) {
  return {
    pos,
    abilities: ['rock_throw', 'earth_wall'],
    cooldowns: { rock_throw: 5 },
    ...extra,
  };
}

describe('the AI and its own walls', () => {
  it('does not wall off its only target when nothing is shooting back', () => {
    /*
     * Rock Throw is ready and the archer across the corridor is out of its own
     * range. The wall buys nothing defensively and would cut off the caster's
     * only ready shot, so it is refused on line-of-sight grounds.
     */
    const { draft, casterIds, enemyIds } = setup({
      grid: corridor(12, 7),
      casters: [{ pos: { x: 2, y: 3 }, abilities: ['rock_throw', 'earth_wall'] }],
      enemies: [{ pos: { x: 7, y: 3 }, abilities: ['flame_arc'] }],
    });
    const casterId = casterIds[0];
    const enemyId = enemyIds[0];
    if (!casterId || !enemyId) throw new Error('Missing wall fixture units');

    planAiTurn(draft, casterId, new RngCursor(7));

    const caster = unit(draft, casterId);
    const enemy = unit(draft, enemyId);
    expect(usedAbilities(draft)).not.toContain('earth_wall');
    // The ready firing line it could not afford to lose is still open.
    expect(hasLineOfSight(draft.grid, caster.pos, enemy.pos)).toBe(true);
  });

  it('does not call a wall stranding when the caster had no ready shot to lose', () => {
    /*
     * Same corridor, but Rock Throw is cooling: before the wall the caster could
     * hit nobody, so the wall costs it nothing this turn and is not stranding.
     * With the rock ready, the same wall is.
     */
    const wallTile: Vec2 = { x: 4, y: 3 };
    const board = {
      grid: corridor(12, 7),
      enemies: [{ pos: { x: 7, y: 3 }, abilities: ['flame_arc'] }],
    };
    const cooling = setup({ ...board, casters: [bender({ x: 2, y: 3 })] });
    expect(
      wallStrandsCaster(cooling.draft, unit(cooling.draft, cooling.casterIds[0]), [wallTile]),
    ).toBe(false);
    const ready = setup({
      ...board,
      casters: [{ pos: { x: 2, y: 3 }, abilities: ['rock_throw', 'earth_wall'] }],
    });
    expect(wallStrandsCaster(ready.draft, unit(ready.draft, ready.casterIds[0]), [wallTile])).toBe(
      true,
    );
  });

  it('steps into a live archer line, then walls it off', () => {
    /*
     * Rock Throw is cooling, so the bender has to move before Earth Wall is in
     * range. The archer is a real threat from that prospective tile; the wall
     * between them is therefore defensive rather than self-stranding.
     */
    const { draft, casterIds, enemyIds } = setup({
      grid: openGrid(12, 9),
      casters: [bender({ x: 2, y: 4 }, { move: 3 })],
      enemies: [{ pos: { x: 8, y: 4 }, abilities: ['sling_stone'] }],
    });
    const casterId = casterIds[0];
    const archerId = enemyIds[0];
    if (!casterId || !archerId) throw new Error('Missing wall fixture units');

    planAiTurn(draft, casterId, new RngCursor(7));

    const caster = unit(draft, casterId);
    const archer = unit(draft, archerId);
    expect(caster.pos).not.toEqual({ x: 2, y: 4 });
    expect(usedAbilities(draft)).toContain('earth_wall');
    expect(hasLineOfSight(draft.grid, archer.pos, caster.pos)).toBe(false);
  });

  it('raises a wall that breaks a live attacker with no shot of its own', () => {
    /*
     * The slinger on the left can hit the caster, so the wall has a defensive
     * job. Rock Throw is cooling, so the wall costs the caster no ready shot and
     * the stranding rule has nothing to refuse; the planner raises it across the
     * slinger's line. (The threat exemption proper is covered by the rule tests
     * below, where the caster does give up a ready shot.)
     */
    const { draft, casterIds, enemyIds } = setup({
      grid: openGrid(12, 9),
      casters: [bender({ x: 5, y: 4 })],
      enemies: [
        { pos: { x: 2, y: 4 }, abilities: ['sling_stone'] },
        { pos: { x: 9, y: 4 }, abilities: ['club_swing'] },
      ],
    });
    const casterId = casterIds[0];
    const archerId = enemyIds[0];
    if (!casterId || !archerId) throw new Error('Missing wall fixture units');

    planAiTurn(draft, casterId, new RngCursor(7));

    const caster = unit(draft, casterId);
    const archer = unit(draft, archerId);
    expect(usedAbilities(draft)).toContain('earth_wall');
    expect(hasLineOfSight(draft.grid, archer.pos, caster.pos)).toBe(false);
  });

  it('permits a wall that breaks a usable attack while leaving a target', () => {
    /*
     * The caster still has Rock Throw, so it can afford the wall: a second
     * slinger across the board is untouched by it. The blocked attacker's own
     * ability really does stop being valid against the post-wall battle, which
     * is what makes this a defensive placement rather than a self-inflicted one.
     */
    const wallTile: Vec2 = { x: 4, y: 4 };
    const { draft, casterIds, enemyIds } = setup({
      grid: openGrid(12, 9),
      casters: [{ pos: { x: 5, y: 4 }, abilities: ['rock_throw', 'earth_wall'] }],
      enemies: [
        { pos: { x: 2, y: 4 }, abilities: ['sling_stone'] },
        { pos: { x: 8, y: 4 }, abilities: ['sling_stone'] },
      ],
    });
    const caster = unit(draft, casterIds[0]);
    const archer = unit(draft, enemyIds[0]);
    const other = unit(draft, enemyIds[1]);
    const sling = ability('sling_stone');
    const before = draft.toBattle();
    const after = { ...before, grid: raised(draft.grid, [wallTile]) };

    // The attacker can reach the caster before the wall, and cannot after it.
    expect(isValidTarget(CONTENT, before, archer, sling, caster.pos).ok).toBe(true);
    expect(isValidTarget(CONTENT, after, archer, sling, caster.pos).ok).toBe(false);
    // The caster keeps a shot of its own, so nobody is stranded.
    expect(isValidTarget(CONTENT, after, caster, ability('rock_throw'), other.pos).ok).toBe(true);
    expect(wallStrandsCaster(draft, caster, [wallTile])).toBe(false);
  });

  it('accepts a wall that shuts an attack down at the cost of its own shot', () => {
    const wallTile: Vec2 = { x: 4, y: 4 };
    const { draft, casterIds, enemyIds } = setup({
      grid: openGrid(12, 9),
      casters: [{ pos: { x: 5, y: 4 }, abilities: ['rock_throw', 'earth_wall'] }],
      enemies: [{ pos: { x: 2, y: 4 }, abilities: ['sling_stone'] }],
    });
    const caster = unit(draft, casterIds[0]);
    const archer = unit(draft, enemyIds[0]);
    const rock = ability('rock_throw');
    const before = draft.toBattle();
    const after = { ...before, grid: raised(draft.grid, [wallTile]) };

    expect(isValidTarget(CONTENT, before, caster, rock, archer.pos).ok).toBe(true);
    expect(isValidTarget(CONTENT, after, caster, rock, archer.pos).ok).toBe(false);
    // No shot of its own left, but the wall broke a live threat: still allowed.
    expect(wallStrandsCaster(draft, caster, [wallTile])).toBe(false);
  });

  it('uses the attacker next-turn AP and cooldown budget', () => {
    /*
     * Same board three times: the only difference is whether the slinger can
     * attack will be ready on its next activation. Current AP is irrelevant
     * because beginTurn refills it; a cooldown longer than one round remains a
     * real reason the attack cannot threaten next turn.
     */
    const wallTile: Vec2 = { x: 4, y: 4 };
    const base: SetupOptions = {
      grid: openGrid(12, 9),
      casters: [{ pos: { x: 5, y: 4 }, abilities: ['rock_throw', 'earth_wall'] }],
      enemies: [{ pos: { x: 2, y: 4 }, abilities: ['sling_stone'] }],
    };
    const stranding = (fixture: Fixture) =>
      wallStrandsCaster(fixture.draft, unit(fixture.draft, fixture.casterIds[0]), [wallTile]);

    const live = setup(base);
    expect(stranding(live)).toBe(false);

    const cooling = setup({
      ...base,
      enemies: [{ pos: { x: 2, y: 4 }, abilities: ['sling_stone'], cooldowns: { sling_stone: 5 } }],
    });
    expect(stranding(cooling)).toBe(true);

    // One round left ticks off at the slinger's own turn start: ready again.
    const readyNext = setup({
      ...base,
      enemies: [{ pos: { x: 2, y: 4 }, abilities: ['sling_stone'], cooldowns: { sling_stone: 1 } }],
    });
    expect(stranding(readyNext)).toBe(false);

    const spent = setup({
      ...base,
      enemies: [{ pos: { x: 2, y: 4 }, abilities: ['sling_stone'], ap: 0 }],
    });
    expect(stranding(spent)).toBe(false);

    /*
     * End to end, through the real turn cycle: the slinger ends its turn (0 AP)
     * before the caster plans. Its hide is thick enough that Rock Throw scores
     * below the wall, so the planner wants the wall — and whether it may raise
     * it depends only on the threat budget. The refreshed slinger still counts,
     * so the wall goes up across the lane; the long-cooling one does not, so a
     * wall across the lane would strand the caster. It may still spend a wall
     * somewhere harmless, but the lane stays open and the rock still flies.
     */
    const planned = (cooldowns: Readonly<Record<string, number>>) => {
      const fixture = setup({
        ...base,
        enemies: [{ pos: { x: 2, y: 4 }, abilities: ['sling_stone'], cooldowns, defense: 60 }],
      });
      const casterId = fixture.casterIds[0];
      const enemyId = fixture.enemyIds[0];
      if (!casterId || !enemyId) throw new Error('Missing wall fixture units');
      fixture.draft.endTurn(enemyId);
      expect(unit(fixture.draft, enemyId).ap).toBe(0);
      planAiTurn(fixture.draft, casterId, new RngCursor(7));
      const caster = unit(fixture.draft, casterId);
      const enemy = unit(fixture.draft, enemyId);
      return {
        used: usedAbilities(fixture.draft),
        sight: hasLineOfSight(fixture.draft.grid, enemy.pos, caster.pos),
      };
    };

    const refreshed = planned({});
    expect(refreshed.used).toContain('earth_wall');
    expect(refreshed.sight).toBe(false);

    const longCooling = planned({ sling_stone: 5 });
    expect(longCooling.used).toContain('rock_throw');
    expect(longCooling.sight).toBe(true);
  });

  it('raises the wall on a cell vacated by a planned move', () => {
    const { draft, casterIds, enemyIds } = setup({
      grid: openGrid(12, 9),
      casters: [{ pos: { x: 3, y: 4 }, abilities: ['rock_throw', 'earth_wall'] }],
      enemies: [{ pos: { x: 1, y: 4 }, abilities: ['sling_stone'] }],
    });
    const movedCaster = { ...unit(draft, casterIds[0]), pos: { x: 5, y: 4 } };
    const enemy = unit(draft, enemyIds[0]);
    const wallTile = { x: 3, y: 4 };
    const battle = draft.toBattle();
    const after = {
      ...battle,
      grid: raised(draft.grid, [wallTile]),
      units: battle.units.map((candidate) =>
        candidate.id === movedCaster.id ? movedCaster : candidate,
      ),
    };

    expect(isValidTarget(CONTENT, after, enemy, ability('sling_stone'), movedCaster.pos).ok).toBe(
      false,
    );
    expect(wallStrandsCaster(draft, movedCaster, [wallTile])).toBe(false);
  });

  it('judges a wall on a vacated cell, and skips the planned cell', () => {
    /*
     * The caster will step back from (4,3) to (2,3) in the corridor. A wall on
     * the cell it leaves really rises and cuts its only shot at an archer who
     * cannot reach it, so it strands the caster. Read occupancy from where the
     * caster stands now and the tile looks taken, the wall looks empty, and the
     * placement slips through. Its planned cell, by contrast, will not take a wall.
     */
    const { draft, casterIds, enemyIds } = setup({
      grid: corridor(12, 7),
      casters: [{ pos: { x: 4, y: 3 }, abilities: ['rock_throw', 'earth_wall'] }],
      enemies: [{ pos: { x: 7, y: 3 }, abilities: ['flame_arc'] }],
    });
    const movedCaster = { ...unit(draft, casterIds[0]), pos: { x: 2, y: 3 } };
    const enemy = unit(draft, enemyIds[0]);
    const rock = ability('rock_throw');
    const battle = draft.toBattle();
    const moved = {
      ...battle,
      units: battle.units.map((candidate) =>
        candidate.id === movedCaster.id ? movedCaster : candidate,
      ),
    };
    const vacated: Vec2 = { x: 4, y: 3 };

    expect(isValidTarget(CONTENT, moved, movedCaster, rock, enemy.pos).ok).toBe(true);
    expect(
      isValidTarget(
        CONTENT,
        { ...moved, grid: raised(draft.grid, [vacated]) },
        movedCaster,
        rock,
        enemy.pos,
      ).ok,
    ).toBe(false);
    expect(wallStrandsCaster(draft, movedCaster, [vacated])).toBe(true);
    expect(wallStrandsCaster(draft, movedCaster, [movedCaster.pos])).toBe(false);
  });

  it('does not call a size-2 caster safe when only its anchor is blocked', () => {
    /*
     * The caster stands on (6,7) and (7,7). Its only target is the clubber at
     * (4,5); the slinger at (2,1) is past Rock Throw's range but inside its own.
     * A wall at (5,6) cuts the caster off from the clubber and hides the anchor
     * cell from the slinger — but the slinger still sees (7,7), so the threat is
     * not broken and the wall strands the caster for nothing.
     */
    const { draft, casterIds, enemyIds } = setup({
      grid: openGrid(14, 15),
      casters: [{ pos: { x: 6, y: 7 }, abilities: ['rock_throw', 'earth_wall'], size: 2 }],
      enemies: [
        { pos: { x: 2, y: 1 }, abilities: ['sling_stone'] },
        { pos: { x: 4, y: 5 }, abilities: ['club_swing'] },
      ],
    });
    const caster = unit(draft, casterIds[0]);
    const slinger = unit(draft, enemyIds[0]);
    const clubber = unit(draft, enemyIds[1]);
    const sling = ability('sling_stone');
    const rock = ability('rock_throw');
    const before = draft.toBattle();
    const second: Vec2 = { x: 7, y: 7 };

    // The slinger is a threat the caster cannot answer; the clubber is its target.
    expect(isValidTarget(CONTENT, before, caster, rock, slinger.pos).ok).toBe(false);
    expect(isValidTarget(CONTENT, before, slinger, sling, caster.pos).ok).toBe(true);
    expect(isValidTarget(CONTENT, before, caster, rock, clubber.pos).ok).toBe(true);

    const anchorWall: Vec2 = { x: 5, y: 6 };
    const anchorAfter = { ...before, grid: raised(draft.grid, [anchorWall]) };
    expect(isValidTarget(CONTENT, anchorAfter, caster, rock, clubber.pos).ok).toBe(false);
    expect(isValidTarget(CONTENT, anchorAfter, slinger, sling, caster.pos).ok).toBe(false);
    expect(isValidTarget(CONTENT, anchorAfter, slinger, sling, second).ok).toBe(true);
    expect(wallStrandsCaster(draft, caster, [anchorWall])).toBe(true);

    // Close the second cell's lane as well and the same trade becomes a block.
    const bothWalls: Vec2[] = [anchorWall, { x: 6, y: 6 }];
    const bothAfter = { ...before, grid: raised(draft.grid, bothWalls) };
    expect(isValidTarget(CONTENT, bothAfter, caster, rock, clubber.pos).ok).toBe(false);
    expect(isValidTarget(CONTENT, bothAfter, slinger, sling, caster.pos).ok).toBe(false);
    expect(isValidTarget(CONTENT, bothAfter, slinger, sling, second).ok).toBe(false);
    expect(wallStrandsCaster(draft, caster, bothWalls)).toBe(false);
  });

  it('does not treat a size-2 attacker as blocked while its second cell fires', () => {
    /*
     * The slinger stands on (2,1) and (3,1), past Rock Throw's range; the
     * caster's only target is the clubber at (3,3). A wall at (4,4) cuts the
     * caster off from the clubber and sits on the slinger's anchor line, but not
     * on the second cell's, so `isValidTarget` still finds a firing origin: the
     * threat is not broken and the wall is refused. Adding (5,5) crosses the
     * second line too, and then the same trade is a genuine block.
     */
    const { draft, casterIds, enemyIds } = setup({
      grid: openGrid(14, 15),
      casters: [{ pos: { x: 6, y: 7 }, abilities: ['rock_throw', 'earth_wall'] }],
      enemies: [
        { pos: { x: 2, y: 1 }, abilities: ['sling_stone'], size: 2 },
        { pos: { x: 3, y: 3 }, abilities: ['club_swing'] },
      ],
    });
    const caster = unit(draft, casterIds[0]);
    const slinger = unit(draft, enemyIds[0]);
    const clubber = unit(draft, enemyIds[1]);
    const anchorOnly: Unit = { ...slinger, size: 1 };
    const sling = ability('sling_stone');
    const rock = ability('rock_throw');
    const before = draft.toBattle();

    expect(isValidTarget(CONTENT, before, caster, rock, slinger.pos).ok).toBe(false);
    expect(isValidTarget(CONTENT, before, caster, rock, { x: 3, y: 1 }).ok).toBe(false);
    expect(isValidTarget(CONTENT, before, caster, rock, clubber.pos).ok).toBe(true);
    expect(isValidTarget(CONTENT, before, slinger, sling, caster.pos).ok).toBe(true);

    const anchorWall: Vec2 = { x: 4, y: 4 };
    const anchorAfter = { ...before, grid: raised(draft.grid, [anchorWall]) };
    expect(isValidTarget(CONTENT, anchorAfter, caster, rock, clubber.pos).ok).toBe(false);
    expect(isValidTarget(CONTENT, anchorAfter, anchorOnly, sling, caster.pos).ok).toBe(false);
    expect(isValidTarget(CONTENT, anchorAfter, slinger, sling, caster.pos).ok).toBe(true);
    expect(wallStrandsCaster(draft, caster, [anchorWall])).toBe(true);

    const bothWalls: Vec2[] = [anchorWall, { x: 5, y: 5 }];
    const bothAfter = { ...before, grid: raised(draft.grid, bothWalls) };
    expect(isValidTarget(CONTENT, bothAfter, caster, rock, clubber.pos).ok).toBe(false);
    expect(isValidTarget(CONTENT, bothAfter, slinger, sling, caster.pos).ok).toBe(false);
    expect(wallStrandsCaster(draft, caster, bothWalls)).toBe(false);
  });

  it('still counts a size-2 target whose anchor the wall hides', () => {
    /*
     * The clubber stands on (2,2) and (3,2) and cannot reach the caster. A wall
     * at (3,3) hides the anchor cell from the caster, but Rock Throw can still
     * be aimed at (3,2), so the caster keeps its target and is not stranded.
     */
    const wallTile: Vec2 = { x: 3, y: 3 };
    const { draft, casterIds, enemyIds } = setup({
      grid: openGrid(12, 9),
      casters: [{ pos: { x: 5, y: 4 }, abilities: ['rock_throw', 'earth_wall'] }],
      enemies: [{ pos: { x: 2, y: 2 }, abilities: ['club_swing'], size: 2 }],
    });
    const caster = unit(draft, casterIds[0]);
    const clubber = unit(draft, enemyIds[0]);
    const rock = ability('rock_throw');
    const after = { ...draft.toBattle(), grid: raised(draft.grid, [wallTile]) };

    expect(isValidTarget(CONTENT, after, caster, rock, clubber.pos).ok).toBe(false);
    expect(isValidTarget(CONTENT, after, caster, rock, { x: 3, y: 2 }).ok).toBe(true);
    expect(wallStrandsCaster(draft, caster, [wallTile])).toBe(false);
  });

  it('scores a full turn for three casters on a 20x12 board inside a budget', () => {
    /*
     * Guard against the tempting-but-wrong fix: asking "can the caster still hit
     * something after this wall?" by sweeping every tile it could walk to. That
     * search ran once per candidate placement, on every scored position, and was
     * the expensive part of a wall-heavy turn. The rule now reads the caster's
     * position only, so a three-bender turn should stay well inside the budget.
     */
    const { draft, casterIds } = setup({
      grid: openGrid(20, 12),
      casters: [
        bender({ x: 3, y: 3 }, { move: 3 }),
        bender({ x: 3, y: 6 }, { move: 3 }),
        bender({ x: 3, y: 9 }, { move: 3 }),
      ],
      enemies: [
        { pos: { x: 7, y: 3 }, abilities: ['sling_stone'] },
        { pos: { x: 7, y: 6 }, abilities: ['sling_stone'] },
        { pos: { x: 7, y: 9 }, abilities: ['sling_stone'] },
      ],
    });

    const started = performance.now();
    for (const id of casterIds) planAiTurn(draft, id, new RngCursor(0x51ce));
    const elapsed = performance.now() - started;

    // Sanity: the casters actually paid for walls rather than skipping the work.
    expect(usedAbilities(draft)).toContain('earth_wall');
    // Generous for loaded CI machines; the rejected full-map search took seconds.
    expect(elapsed).toBeLessThan(1500);
  });
});
