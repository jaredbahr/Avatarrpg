import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { createBattle, createGame } from '../state/createGame';
import { BattleDraft } from '../state/battleDraft';
import type { Ability, BattleState } from '../types';
import {
  affectedTiles,
  isValidTarget,
  previewAbility,
  resolveAbility,
  targetableTiles,
  validatingOrigin,
} from './abilities';
import { distance, hasLineOfSight, inBounds, lineTiles, posKey } from './grid';
import { hitChance } from './damage';

function fixture(): { battle: BattleState; caster: BattleState['units'][number] } {
  const game = createGame(CONTENT, {
    seed: 'height-reach',
    party: [{ characterId: 'kaya', level: 3 }],
    startNode: '',
  });
  const battle = createBattle(CONTENT, game, 'enc_quarry_gate', new RngCursor(game.rng));
  const caster = battle.units.find((unit) => unit.faction === 'party');
  if (!caster) throw new Error('Missing caster fixture');
  return { battle, caster };
}

function open(battle: BattleState): BattleState {
  return {
    ...battle,
    grid: {
      ...battle.grid,
      tiles: battle.grid.tiles.map((tile) => ({
        ...tile,
        blocked: false,
        blocksSight: false,
        cover: false,
        elevation: 0,
        terrain: 'dirt',
      })),
    },
  };
}

const longRange: Ability = {
  id: 'test_height_reach',
  name: 'Test reach',
  element: 'earth',
  apCost: 1,
  cooldown: 0,
  range: 3,
  minRange: 0,
  requiresLineOfSight: true,
  targeting: { shape: 'tile' },
  effects: [],
  tags: ['attack'],
  description: '',
  flavor: '',
  fx: 'fx.none',
};

describe('height reach', () => {
  it('adds one range only for long-range LOS abilities from higher ground', () => {
    const { battle: source, caster } = fixture();
    const battle = open(source);
    const elevated = {
      ...battle,
      grid: {
        ...battle.grid,
        tiles: battle.grid.tiles.map((tile, index) => ({
          ...tile,
          elevation: index === caster.pos.y * battle.grid.width + caster.pos.x ? 1 : 0,
        })),
      },
    };
    const distant = { x: caster.pos.x + 4, y: caster.pos.y };
    expect(isValidTarget(CONTENT, elevated, caster, longRange, distant).ok).toBe(true);
    expect(isValidTarget(CONTENT, battle, caster, longRange, distant).ok).toBe(false);
    expect(isValidTarget(CONTENT, elevated, caster, { ...longRange, range: 2 }, distant).ok).toBe(
      false,
    );
    expect(
      isValidTarget(
        CONTENT,
        elevated,
        caster,
        { ...longRange, requiresLineOfSight: false },
        distant,
      ).ok,
    ).toBe(false);
  });

  it('excludes dashes and self-targeted abilities', () => {
    const { battle: source, caster } = fixture();
    const battle = open(source);
    const elevated = {
      ...battle,
      grid: {
        ...battle.grid,
        tiles: battle.grid.tiles.map((tile, index) => ({
          ...tile,
          elevation: index === caster.pos.y * battle.grid.width + caster.pos.x ? 1 : 0,
        })),
      },
    };
    const dash = { ...longRange, effects: [{ kind: 'dash' as const }] };
    const distant = { x: caster.pos.x + 4, y: caster.pos.y };
    expect(isValidTarget(CONTENT, elevated, caster, dash, distant).ok).toBe(false);
    expect(
      isValidTarget(
        CONTENT,
        elevated,
        caster,
        { ...longRange, targeting: { shape: 'self' } },
        caster.pos,
      ).ok,
    ).toBe(true);
  });

  it('enumerates every valid tile from every occupied caster cell', () => {
    const { battle: source, caster: originalCaster } = fixture();
    const caster = { ...originalCaster, size: 2 as const };
    const opened = open({
      ...source,
      units: source.units.map((unit) => (unit.id === caster.id ? caster : unit)),
    });
    const battle = {
      ...opened,
      grid: {
        ...opened.grid,
        tiles: opened.grid.tiles.map((tile, index) => ({
          ...tile,
          elevation:
            index === caster.pos.y * opened.grid.width + caster.pos.x ||
            index === caster.pos.y * opened.grid.width + caster.pos.x + 1
              ? 1
              : 0,
        })),
      },
    };
    const valid = [] as { x: number; y: number }[];
    for (let y = 0; y < battle.grid.height; y++) {
      for (let x = 0; x < battle.grid.width; x++) {
        const tile = { x, y };
        if (isValidTarget(CONTENT, battle, caster, longRange, tile).ok) valid.push(tile);
      }
    }
    expect(new Set(targetableTiles(CONTENT, battle, caster, longRange).map(posKey))).toEqual(
      new Set(valid.map(posKey)),
    );

    const pastOriginRange = valid.find(
      (tile) => distance(caster.pos, tile) > longRange.range + 1 && inBounds(battle.grid, tile),
    );
    expect(pastOriginRange).toBeDefined();
  });

  it('accepts a size-2 target when only the second occupied cell has line of sight', () => {
    const { battle: source, caster: originalCaster } = fixture();
    const caster = { ...originalCaster, pos: { x: 2, y: 2 }, size: 2 as const };
    const target = { x: 3, y: 5 };
    const battle = open({
      ...source,
      units: source.units.map((unit) => (unit.id === caster.id ? caster : unit)),
    });
    const wallIndex = 3 * battle.grid.width + 2;
    const blocked = {
      ...battle,
      grid: {
        ...battle.grid,
        tiles: battle.grid.tiles.map((tile, index) =>
          index === wallIndex ? { ...tile, blocksSight: true } : tile,
        ),
      },
    };

    expect(hasLineOfSight(blocked.grid, caster.pos, target)).toBe(false);
    expect(hasLineOfSight(blocked.grid, { x: 3, y: 2 }, target)).toBe(true);
    expect(isValidTarget(CONTENT, blocked, caster, longRange, target).ok).toBe(true);
  });

  it('does not combine elevation from one occupied cell with LOS from another', () => {
    const { battle: source, caster: originalCaster } = fixture();
    const caster = { ...originalCaster, pos: { x: 2, y: 2 }, size: 2 as const };
    const target = { x: 3, y: 6 };
    const battle = open({
      ...source,
      units: source.units.map((unit) => (unit.id === caster.id ? caster : unit)),
    });
    const elevatedIndex = caster.pos.y * battle.grid.width + caster.pos.x;
    const wallIndex = 3 * battle.grid.width + 2;
    const splitOrigins = {
      ...battle,
      grid: {
        ...battle.grid,
        tiles: battle.grid.tiles.map((tile, index) => ({
          ...tile,
          elevation: index === elevatedIndex ? 1 : 0,
          blocksSight: index === wallIndex,
        })),
      },
    };

    expect(hasLineOfSight(splitOrigins.grid, caster.pos, target)).toBe(false);
    expect(hasLineOfSight(splitOrigins.grid, { x: 3, y: 2 }, target)).toBe(true);
    expect(isValidTarget(CONTENT, splitOrigins, caster, longRange, target).ok).toBe(false);

    const joinedOrigin = {
      ...splitOrigins,
      grid: {
        ...splitOrigins.grid,
        tiles: splitOrigins.grid.tiles.map((tile, index) =>
          index === elevatedIndex + 1 ? { ...tile, elevation: 1 } : tile,
        ),
      },
    };
    expect(isValidTarget(CONTENT, joinedOrigin, caster, longRange, target).ok).toBe(true);
  });

  it('draws a size-2 line from whichever occupied cell validates, in anchor-first order', () => {
    const { battle: source, caster: originalCaster } = fixture();
    const caster = { ...originalCaster, pos: { x: 2, y: 2 }, size: 2 as const };
    const target = { x: 5, y: 5 };
    const ability: Ability = {
      ...longRange,
      range: 5,
      targeting: { shape: 'line', length: 4 },
    };
    const battle = open({
      ...source,
      units: source.units.map((unit) => (unit.id === caster.id ? caster : unit)),
    });
    const withSightBlocker = (x: number, y: number): BattleState => ({
      ...battle,
      grid: {
        ...battle.grid,
        tiles: battle.grid.tiles.map((tile, index) =>
          index === y * battle.grid.width + x ? { ...tile, blocksSight: true } : tile,
        ),
      },
    });

    const anchorBlocked = withSightBlocker(3, 3);
    expect(lineTiles(anchorBlocked.grid, caster.pos, target, 4)).toContainEqual({ x: 3, y: 3 });
    expect(lineTiles(anchorBlocked.grid, { x: 3, y: 2 }, target, 4)).not.toContainEqual({
      x: 3,
      y: 3,
    });
    expect(validatingOrigin(CONTENT, anchorBlocked.grid, caster, ability, target)).toEqual({
      x: 3,
      y: 2,
    });
    expect(affectedTiles(CONTENT, anchorBlocked.grid, caster, ability, target)).toEqual(
      lineTiles(anchorBlocked.grid, { x: 3, y: 2 }, target, 4),
    );

    const secondBlocked = withSightBlocker(4, 3);
    expect(lineTiles(secondBlocked.grid, { x: 3, y: 2 }, target, 4)).toContainEqual({
      x: 4,
      y: 3,
    });
    expect(lineTiles(secondBlocked.grid, caster.pos, target, 4)).not.toContainEqual({
      x: 4,
      y: 3,
    });
    expect(validatingOrigin(CONTENT, secondBlocked.grid, caster, ability, target)).toEqual(
      caster.pos,
    );
    expect(affectedTiles(CONTENT, secondBlocked.grid, caster, ability, target)).toEqual(
      lineTiles(secondBlocked.grid, caster.pos, target, 4),
    );
  });

  it('keeps size-1 range, height reach, and anchor LOS unchanged over the whole board', () => {
    const { battle: source, caster: originalCaster } = fixture();
    const caster = { ...originalCaster, pos: { x: 2, y: 2 }, size: 1 as const };
    const battle = open({
      ...source,
      units: source.units.map((unit) => (unit.id === caster.id ? caster : unit)),
    });
    const casterIndex = caster.pos.y * battle.grid.width + caster.pos.x;
    const wallIndex = 3 * battle.grid.width + 2;
    const varied = {
      ...battle,
      grid: {
        ...battle.grid,
        tiles: battle.grid.tiles.map((tile, index) => ({
          ...tile,
          elevation: index === casterIndex ? 1 : 0,
          blocksSight: index === wallIndex,
        })),
      },
    };
    const lineAbility: Ability = {
      ...longRange,
      range: 5,
      targeting: { shape: 'line', length: 4 },
    };

    for (let y = 0; y < varied.grid.height; y++) {
      for (let x = 0; x < varied.grid.width; x++) {
        const target = { x, y };
        const expected =
          distance(caster.pos, target) <= longRange.range + CONTENT.tuning.heightReachBonus &&
          hasLineOfSight(varied.grid, caster.pos, target);
        expect(isValidTarget(CONTENT, varied, caster, longRange, target).ok).toBe(expected);
        expect(affectedTiles(CONTENT, varied.grid, caster, lineAbility, target)).toEqual(
          lineTiles(varied.grid, caster.pos, target, 4),
        );
      }
    }
  });

  it('previews the same plunging hit chance used by resolution without mutating state', () => {
    const { battle: source, caster: originalCaster } = fixture();
    const target = source.units.find((unit) => unit.faction === 'enemy');
    if (!target) throw new Error('Missing target fixture');
    const ability = CONTENT.abilities.get('fire_blast');
    if (!ability) throw new Error('Missing fire blast');
    const caster = { ...originalCaster, pos: { x: 2, y: 2 } };
    const defender = { ...target, pos: { x: 2, y: 5 } };
    const battle = open({
      ...source,
      units: source.units.map((unit) =>
        unit.id === caster.id ? caster : unit.id === defender.id ? defender : unit,
      ),
    });
    const casterIndex = caster.pos.y * battle.grid.width + caster.pos.x;
    const defenderIndex = defender.pos.y * battle.grid.width + defender.pos.x;
    const plungingBattle = {
      ...battle,
      grid: {
        ...battle.grid,
        tiles: battle.grid.tiles.map((tile, index) => ({
          ...tile,
          elevation: index === casterIndex ? 1 : 0,
          cover: index === defenderIndex,
        })),
      },
    };
    const tuning = CONTENT.tuning;
    const rawExpectedChance =
      tuning.baseHitChance +
      tuning.elevationStep -
      tuning.coverPenalty +
      Math.floor(tuning.coverPenalty / tuning.plungingCoverDivisor);
    const expectedChance = Math.max(
      tuning.hitChanceMin,
      Math.min(tuning.hitChanceMax, rawExpectedChance),
    );

    const before = JSON.stringify(plungingBattle);
    const preview = previewAbility(CONTENT, plungingBattle, caster, ability, defender.pos);
    expect(preview.targets.find((entry) => entry.unitId === defender.id)?.hitChance).toBe(
      expectedChance,
    );
    expect(hitChance(CONTENT, plungingBattle.grid, caster, defender)).toBe(expectedChance);
    expect(expectedChance).toBeGreaterThan(
      tuning.baseHitChance + tuning.elevationStep - tuning.coverPenalty,
    );
    expect(JSON.stringify(plungingBattle)).toBe(before);
    const draft = new BattleDraft(CONTENT, plungingBattle, new RngCursor(1));
    resolveAbility(draft, caster, ability, defender.pos, draft.rng);
    expect(draft.events.some((event) => event.type === 'abilityUsed')).toBe(true);
  });
});
