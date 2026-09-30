import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { previewAbility, resolveAbility } from '../rules/abilities';
import { DEFAULT_TILE, tileAt, withTile } from '../rules/grid';
import type { MoveContext } from '../rules/grid';
import type { Ability, BattleState, Grid, Unit, Vec2 } from '../types';
import { BattleDraft } from './battleDraft';
import { createBattle, createGame } from './createGame';

function ability(id: string): Ability {
  const found = CONTENT.abilities.get(id);
  if (!found) throw new Error(`missing ability ${id}`);
  return found;
}

function fixture(): { battle: BattleState; caster: Unit; victim: Unit } {
  const game = createGame(CONTENT, {
    seed: 'footprint-draft',
    party: [{ characterId: 'kaya', level: 3, autoChoose: true }],
    startNode: '',
  });
  const battle = createBattle(CONTENT, game, 'enc_quarry_gate', new RngCursor(game.rng));
  const caster = battle.units.find((unit) => unit.faction === 'party');
  const victim = battle.units.find((unit) => unit.faction === 'enemy');
  if (!caster || !victim) throw new Error('footprint fixture is missing units');
  return { battle, caster, victim };
}

/** Keep only the bodies a scenario needs, on an empty board. */
function placed(battle: BattleState, positions: Readonly<Record<string, Vec2>>): BattleState {
  const units = battle.units
    .filter((unit) => positions[unit.id])
    .map((unit) => ({ ...unit, pos: positions[unit.id] as Vec2 }));
  return {
    ...battle,
    units,
    order: units.map((unit) => unit.id),
    turnIndex: 0,
    props: [],
    temporaryWalls: [],
  };
}

/** Flat, empty ground, so only the geometry under test matters. */
function openGround(battle: BattleState): BattleState {
  return { ...battle, grid: { ...battle.grid, tiles: battle.grid.tiles.map(() => DEFAULT_TILE) } };
}

function withSize(battle: BattleState, unitId: string, size: 1 | 2): BattleState {
  return {
    ...battle,
    units: battle.units.map((unit) => (unit.id === unitId ? { ...unit, size } : unit)),
  };
}

function setTile(battle: BattleState, pos: Vec2, patch: Partial<typeof DEFAULT_TILE>): BattleState {
  const tile = tileAt(battle.grid, pos);
  if (!tile) throw new Error(`off-grid tile ${pos.x},${pos.y}`);
  return { ...battle, grid: withTile(battle.grid, pos, { ...tile, ...patch }) };
}

function elevated(battle: BattleState, elevations: Readonly<Record<string, number>>): BattleState {
  let next = battle;
  for (const [key, elevation] of Object.entries(elevations)) {
    const [x, y] = key.split(',').map(Number);
    if (x === undefined || y === undefined) throw new Error(`invalid tile key ${key}`);
    next = setTile(next, { x, y }, { elevation });
  }
  return next;
}

function moveCtx(grid: Grid, size: 1 | 2, square: boolean): MoveContext {
  return {
    grid,
    blocked: new Set(),
    surfaces: CONTENT.surfaces,
    size,
    squareFootprints: square,
    climbCost: CONTENT.tuning.climbCost,
  };
}

describe('2x2 slide direction', () => {
  const { battle } = fixture();
  const draft = new BattleDraft(CONTENT, openGround(battle), new RngCursor(1), {
    squareFootprints: true,
  });
  const ctx = moveCtx(draft.grid, 2, true);
  const from = { x: 4, y: 4 };

  it('moves one tile away from every side and diagonal', () => {
    const cases: readonly (readonly [Vec2, Vec2])[] = [
      [
        { x: 2, y: 4 },
        { x: 1, y: 0 },
      ],
      [
        { x: 8, y: 4 },
        { x: -1, y: 0 },
      ],
      [
        { x: 4, y: 2 },
        { x: 0, y: 1 },
      ],
      [
        { x: 4, y: 8 },
        { x: 0, y: -1 },
      ],
      [
        { x: 2, y: 2 },
        { x: 1, y: 1 },
      ],
      [
        { x: 8, y: 2 },
        { x: -1, y: 1 },
      ],
      [
        { x: 2, y: 8 },
        { x: 1, y: -1 },
      ],
      [
        { x: 8, y: 8 },
        { x: -1, y: -1 },
      ],
    ];
    for (const [origin, step] of cases) {
      const slide = draft.slideFrom(ctx, from, origin, 1, 'push');
      expect(slide.stopReason).toBe('none');
      expect(slide.pos).toEqual({ x: from.x + step.x, y: from.y + step.y });
    }
  });

  it('reports a centre hit when the origin is inside the block', () => {
    expect(draft.slideFrom(ctx, from, { x: 5, y: 5 }, 1, 'push')).toEqual({
      pos: from,
      ledgeDropTiers: 0,
      stopReason: 'centre',
    });
  });

  it('keeps the anchor-sign rule for size 1', () => {
    const one = moveCtx(draft.grid, 1, true);
    expect(draft.slideFrom(one, { x: 5, y: 5 }, { x: 3, y: 3 }, 1, 'push').pos).toEqual({
      x: 6,
      y: 6,
    });
    expect(draft.slideFrom(one, { x: 5, y: 5 }, { x: 3, y: 3 }, 1, 'pull').pos).toEqual({
      x: 4,
      y: 4,
    });
  });
});

describe('2x2 forced movement', () => {
  it('stops short of a wall that the legacy 2x1 would slide past', () => {
    const { battle, caster, victim } = fixture();
    const field = setTile(
      withSize(
        openGround(placed(battle, { [caster.id]: { x: 5, y: 5 }, [victim.id]: { x: 6, y: 5 } })),
        victim.id,
        2,
      ),
      { x: 9, y: 6 },
      { blocked: true },
    );

    const squareDraft = new BattleDraft(CONTENT, field, new RngCursor(1), {
      squareFootprints: true,
    });
    squareDraft.shove(victim.id, { x: 5, y: 5 }, 2, 'push');
    expect(squareDraft.unit(victim.id)?.pos).toEqual({ x: 7, y: 5 });

    const legacyDraft = new BattleDraft(CONTENT, field, new RngCursor(1));
    legacyDraft.shove(victim.id, { x: 5, y: 5 }, 2, 'push');
    expect(legacyDraft.unit(victim.id)?.pos).toEqual({ x: 8, y: 5 });
  });

  it('refuses to shove a 2x2 up a bare ledge', () => {
    const { battle, caster, victim } = fixture();
    const field = elevated(
      withSize(
        openGround(placed(battle, { [caster.id]: { x: 5, y: 5 }, [victim.id]: { x: 6, y: 5 } })),
        victim.id,
        2,
      ),
      { '8,5': 1, '8,6': 1 },
    );
    const draft = new BattleDraft(CONTENT, field, new RngCursor(1), { squareFootprints: true });
    draft.shove(victim.id, { x: 5, y: 5 }, 1, 'push');
    expect(draft.unit(victim.id)?.pos).toEqual({ x: 6, y: 5 });
  });

  it('stops a 2x2 at the edge of a ledge and takes no fall', () => {
    const { battle, caster, victim } = fixture();
    const field = elevated(
      withSize(
        openGround(placed(battle, { [caster.id]: { x: 5, y: 5 }, [victim.id]: { x: 6, y: 5 } })),
        victim.id,
        2,
      ),
      { '6,5': 2, '7,5': 2, '6,6': 2, '7,6': 2, '8,5': 0, '8,6': 0 },
    );
    const draft = new BattleDraft(CONTENT, field, new RngCursor(1), { squareFootprints: true });
    const live = draft.unit(victim.id);
    if (!live) throw new Error('missing edge victim');
    // Far more HP than any fall could take, so damage would be visible.
    draft.replace({ ...live, hp: 30 });

    // The next step would leave two cells on the plateau and two hanging off
    // it: the strict reading makes the ledge a wall, so the block stays put,
    // reports no drop tiers and takes no fall.
    expect(draft.shove(victim.id, { x: 5, y: 5 }, 1, 'push')).toBe(0);
    expect(draft.unit(victim.id)?.pos).toEqual({ x: 6, y: 5 });
    expect(draft.unit(victim.id)?.hp).toBe(30);
    expect(
      draft.events.some((event) => event.type === 'damaged' && event.cause === 'ledgeDrop'),
    ).toBe(false);
  });

  it('stops a 2x2 at the edge however far the shove would carry it off', () => {
    const { battle, caster, victim } = fixture();
    const field = elevated(
      withSize(
        openGround(placed(battle, { [caster.id]: { x: 5, y: 5 }, [victim.id]: { x: 6, y: 5 } })),
        victim.id,
        2,
      ),
      { '6,5': 2, '7,5': 2, '6,6': 2, '7,6': 2, '8,5': 0, '8,6': 0 },
    );
    const draft = new BattleDraft(CONTENT, field, new RngCursor(1), { squareFootprints: true });
    const live = draft.unit(victim.id);
    if (!live) throw new Error('missing edge victim');
    draft.replace({ ...live, hp: 30 });

    // Two tiles of knockback would clear the lip and put the whole block on the
    // lower tier. With the strict reading it never gets there: the first step
    // straddles a non-ramp drop, so it stops at the edge with `obstacle` and
    // takes no fall at all.
    const slide = draft.slideFrom(
      moveCtx(draft.grid, 2, true),
      { x: 6, y: 5 },
      { x: 5, y: 5 },
      2,
      'push',
    );
    expect(slide).toEqual({ pos: { x: 6, y: 5 }, ledgeDropTiers: 0, stopReason: 'obstacle' });
    expect(draft.shove(victim.id, { x: 5, y: 5 }, 2, 'push')).toBe(0);
    expect(draft.unit(victim.id)?.pos).toEqual({ x: 6, y: 5 });
    expect(draft.unit(victim.id)?.hp).toBe(30);
    expect(
      draft.events.some((event) => event.type === 'damaged' && event.cause === 'ledgeDrop'),
    ).toBe(false);
  });

  it('falls back to the last flat footprint when a one-tile shove would end on a ramp', () => {
    const { battle, caster, victim } = fixture();
    let field = withSize(
      openGround(placed(battle, { [caster.id]: { x: 5, y: 5 }, [victim.id]: { x: 6, y: 5 } })),
      victim.id,
      2,
    );
    // A single-column tier-1 ramp at x 8 rising to tier-1 ground from x 9 on.
    field = setTile(field, { x: 8, y: 5 }, { elevation: 1, ramp: true });
    field = setTile(field, { x: 8, y: 6 }, { elevation: 1, ramp: true });
    field = setTile(field, { x: 9, y: 5 }, { elevation: 1 });
    field = setTile(field, { x: 9, y: 6 }, { elevation: 1 });
    field = setTile(field, { x: 10, y: 5 }, { elevation: 1 });
    field = setTile(field, { x: 10, y: 6 }, { elevation: 1 });
    const draft = new BattleDraft(CONTENT, field, new RngCursor(1), { squareFootprints: true });

    // One tile of knockback would leave the block half on the ramp: a legal step
    // to cross, but not a footprint to rest on. Flatness -- not the (zero) drop
    // tally -- has to send it back to the last flat position.
    const slide = draft.slideFrom(
      moveCtx(draft.grid, 2, true),
      { x: 6, y: 5 },
      { x: 5, y: 5 },
      1,
      'push',
    );
    expect(slide).toEqual({ pos: { x: 6, y: 5 }, ledgeDropTiers: 0, stopReason: 'obstacle' });
    expect(draft.shove(victim.id, { x: 5, y: 5 }, 1, 'push')).toBe(0);
    expect(draft.unit(victim.id)?.pos).toEqual({ x: 6, y: 5 });
  });

  it('carries a 2x2 over a ramp when the shove is long enough to end flat', () => {
    const { battle, caster, victim } = fixture();
    let field = withSize(
      openGround(placed(battle, { [caster.id]: { x: 5, y: 5 }, [victim.id]: { x: 6, y: 5 } })),
      victim.id,
      2,
    );
    field = setTile(field, { x: 8, y: 5 }, { elevation: 1, ramp: true });
    field = setTile(field, { x: 8, y: 6 }, { elevation: 1, ramp: true });
    field = setTile(field, { x: 9, y: 5 }, { elevation: 1 });
    field = setTile(field, { x: 9, y: 6 }, { elevation: 1 });
    field = setTile(field, { x: 10, y: 5 }, { elevation: 1 });
    field = setTile(field, { x: 10, y: 6 }, { elevation: 1 });
    const draft = new BattleDraft(CONTENT, field, new RngCursor(1), { squareFootprints: true });
    const live = draft.unit(victim.id);
    if (!live) throw new Error('missing ramp victim');
    draft.replace({ ...live, hp: 30 });

    // Three tiles carry the block across the ramp and clear of it, landing flat
    // on the tier-1 ground beyond. A ramp is still a way up and over.
    const slide = draft.slideFrom(
      moveCtx(draft.grid, 2, true),
      { x: 6, y: 5 },
      { x: 5, y: 5 },
      3,
      'push',
    );
    expect(slide).toEqual({ pos: { x: 9, y: 5 }, ledgeDropTiers: 0, stopReason: 'none' });
    expect(draft.shove(victim.id, { x: 5, y: 5 }, 3, 'push')).toBe(0);
    expect(draft.unit(victim.id)?.pos).toEqual({ x: 9, y: 5 });
    expect(draft.unit(victim.id)?.hp).toBe(30);
  });

  it('forecasts the same 2x2 shove the resolver performs', () => {
    const { battle, caster, victim } = fixture();
    const field = setTile(
      withSize(
        openGround(placed(battle, { [caster.id]: { x: 5, y: 5 }, [victim.id]: { x: 6, y: 5 } })),
        victim.id,
        2,
      ),
      { x: 9, y: 6 },
      { blocked: true },
    );
    const target = field.units.find((unit) => unit.id === victim.id);
    const shooter = field.units.find((unit) => unit.id === caster.id);
    if (!target || !shooter) throw new Error('missing parity units');

    const preview = previewAbility(CONTENT, field, shooter, ability('air_blast'), target.pos, true);
    const shove = preview.shoves.find((entry) => entry.id === victim.id);
    expect(shove).toMatchObject({ to: { x: 7, y: 5 }, movedDistance: 1, stopReason: 'obstacle' });

    const draft = new BattleDraft(CONTENT, field, new RngCursor(0x5eed), {
      squareFootprints: true,
    });
    const resolvedCaster = draft.unit(caster.id);
    if (!resolvedCaster) throw new Error('missing parity caster');
    resolveAbility(draft, resolvedCaster, ability('air_blast'), target.pos, draft.rng);
    expect(draft.unit(victim.id)?.pos).toEqual(shove?.to);
  });

  it('stops a pull before any footprint cell covers the origin', () => {
    const { battle, victim } = fixture();
    const field = withSize(
      openGround(placed(battle, { [victim.id]: { x: 4, y: 4 } })),
      victim.id,
      2,
    );
    const draft = new BattleDraft(CONTENT, field, new RngCursor(1), { squareFootprints: true });

    // Pulling toward (8,4): the first step that would cover the origin puts the
    // block's right cell on it, so the pull stops one step earlier, at (6,4).
    const slide = draft.slideFrom(
      moveCtx(draft.grid, 2, true),
      { x: 4, y: 4 },
      { x: 8, y: 4 },
      5,
      'pull',
    );
    expect(slide).toEqual({ pos: { x: 6, y: 4 }, ledgeDropTiers: 0, stopReason: 'origin' });

    draft.shove(victim.id, { x: 8, y: 4 }, 5, 'pull');
    expect(draft.unit(victim.id)?.pos).toEqual({ x: 6, y: 4 });
  });
});
