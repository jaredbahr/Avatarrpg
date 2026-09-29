import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { createBattle, createGame } from '../state/createGame';
import { BattleDraft } from '../state/battleDraft';
import type { Ability, BattleState } from '../types';
import { isValidTarget, previewAbility, resolveAbility, targetableTiles } from './abilities';
import { distance, hasLineOfSight, inBounds, posKey } from './grid';
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
    const battle = open({
      ...source,
      units: source.units.map((unit) => (unit.id === caster.id ? caster : unit)),
      grid: {
        ...source.grid,
        tiles: source.grid.tiles.map((tile, index) => ({
          ...tile,
          elevation:
            index === caster.pos.y * source.grid.width + caster.pos.x ||
            index === caster.pos.y * source.grid.width + caster.pos.x + 1
              ? 1
              : 0,
        })),
      },
    });
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

    for (let y = 0; y < varied.grid.height; y++) {
      for (let x = 0; x < varied.grid.width; x++) {
        const target = { x, y };
        const expected =
          distance(caster.pos, target) <= longRange.range + CONTENT.tuning.heightReachBonus &&
          hasLineOfSight(varied.grid, caster.pos, target);
        expect(isValidTarget(CONTENT, varied, caster, longRange, target).ok).toBe(expected);
      }
    }
  });

  it('uses the same non-random hit calculation for preview and resolution', () => {
    const { battle, caster } = fixture();
    const target = battle.units.find((unit) => unit.faction === 'enemy');
    if (!target) throw new Error('Missing target fixture');
    const ability = CONTENT.abilities.get('fire_blast');
    if (!ability) throw new Error('Missing fire blast');
    const previewRng = new RngCursor(1);
    const preview = previewAbility(CONTENT, battle, caster, ability, target.pos);
    expect(previewRng.state).toBe(1);
    expect(preview.targets.find((entry) => entry.unitId === target.id)?.hitChance).toBe(
      hitChance(CONTENT, battle.grid, caster, target),
    );
    const before = JSON.stringify(battle);
    previewAbility(CONTENT, battle, caster, ability, target.pos);
    expect(JSON.stringify(battle)).toBe(before);
    const draft = new BattleDraft(CONTENT, battle, new RngCursor(1));
    resolveAbility(draft, caster, ability, target.pos, draft.rng);
    expect(draft.events.some((event) => event.type === 'abilityUsed')).toBe(true);
  });
});
