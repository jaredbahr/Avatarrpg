import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { createBattle, createGame } from '../state/createGame';
import { BattleDraft } from '../state/battleDraft';
import type { Ability, BattleState } from '../types';
import { isValidTarget, previewAbility, resolveAbility } from './abilities';
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
